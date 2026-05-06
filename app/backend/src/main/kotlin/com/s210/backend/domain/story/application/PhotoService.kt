package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.s3.S3DeletionEvent
import com.s210.backend.common.s3.S3Service
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.application.dto.CreatePhotoCommand
import com.s210.backend.domain.story.application.dto.ModifyPhotoCommand
import com.s210.backend.domain.story.application.dto.PhotoResult
import com.s210.backend.domain.story.entity.PhotoAlbumItem
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.PhotoAlbumItemRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.PhotoPurpose
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.LocalDateTime

/**
 * Step 2 (사진 업로드) 의 도메인 유스케이스.
 *
 * 3-phase 업로드 흐름:
 *  1. `presignUpload` — FE 가 브라우저에서 S3 로 직접 PUT 할 URL 발급
 *  2. (FE → S3 직접 PUT) — BE 를 거치지 않음
 *  3. `addPhoto` — FE 가 s3Key 를 commit → DB `photo_album_items` INSERT
 *
 * 조회/삭제는 대칭적 CRUD.
 */
@Service
@Transactional
class PhotoService(
    private val photoRepository: PhotoAlbumItemRepository,
    private val storyRepository: StoryRepository,
    private val s3Service: S3Service,
    private val eventPublisher: ApplicationEventPublisher,
    private val jobRepository: StoryGenerationJobRepository,
) {

    /**
     * Step 2 업로드용 presigned PUT URL 발급.
     * 소유권 검증 후 `stories/{storyId}/photos/{uuid}.{ext}` 패턴 key 생성.
     *
     * 추억 사진 업로드 (`STORYBOARD`) / 대표 사진 별도 업로드 (`CHARACTER_REF`) 모두 같은
     * S3 path 패턴을 사용 — purpose 구분은 commit 단계에서.
     * 단, `CHARACTER_REF` 업로드 의도이면 lock 검증 (배치 generate 시작 후 거부).
     */
    @Transactional(readOnly = true)
    fun presignUpload(
        userId: Long,
        storyId: Long,
        contentType: String,
        purpose: PhotoPurpose = PhotoPurpose.STORYBOARD,
    ): S3Service.PresignedUpload {
        ownedStory(userId, storyId)
        // 줄거리(SUMMARY) 가 이미 생성/진행되었으면 Step 2 mutation 전체를 막아 downstream 일관성 보호.
        ensureStorySummaryNotStarted(storyId)
        if (purpose == PhotoPurpose.CHARACTER_REF) {
            ensureNotLocked(storyId)
        }
        return s3Service.presignPhotoPutUrl(storyId, contentType)
    }

    /**
     * S3 업로드 완료 후 commit — DB 에 row 생성.
     *
     * 검증:
     *  - 소유권 (`ownedStory`)
     *  - `s3Key` prefix 가 정확히 `stories/{storyId}/photos/` 여야 함
     *    → FE 가 다른 story 의 key 를 보내서 오염시키는 것 방지.
     *  - `purpose` 는 `STORYBOARD` 또는 `CHARACTER_REF` 만 허용 (`BOTH` 는 토글 endpoint 전용).
     *  - `CHARACTER_REF` commit 시:
     *      · max-3 검증 (CHARACTER_REF + BOTH 합산)
     *      · Lock 검증 (첫 STORYBOARD_IMAGE 잡 시작 후엔 거부)
     *  - NOTE: S3 에 실제 객체가 있는지(headObject) 는 이번 MR 에선 스킵.
     *          AWS SDK 호출 1회 추가 & 권한 요구 증가. orphan 정리는 배치로 처리 예정.
     *
     * `displayOrder` 는 현재 story 의 마지막 사진 다음 번호로 자동 부여.
     */
    fun addPhoto(command: CreatePhotoCommand): PhotoResult {
        ownedStory(command.userId, command.storyId)
        ensureStorySummaryNotStarted(command.storyId)

        // env-prefix(local/dev/prod) + 본 prefix 모두 일치 검증.
        // S3Service.applyEnvPrefix 가 presign 시점에 env-prefix 를 박아주므로 여기서도 동일 헬퍼 사용.
        val expectedPrefix = s3Service.applyEnvPrefix("stories/${command.storyId}/photos/")
        if (!command.s3Key.startsWith(expectedPrefix)) {
            throw BusinessException(StoryErrorCode.INVALID_PHOTO_FORMAT)
        }
        if (command.purpose != PhotoPurpose.STORYBOARD && command.purpose != PhotoPurpose.CHARACTER_REF) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        if (command.purpose == PhotoPurpose.CHARACTER_REF) {
            ensureNotLocked(command.storyId)
            ensureCharacterRefCapacity(command.storyId, delta = 1)
        }

        val nextOrder = photoRepository
            .findFirstByStoryIdAndDeletedAtIsNullOrderByDisplayOrderDesc(command.storyId)
            ?.let { it.displayOrder + 1 } ?: 0L

        val saved = photoRepository.save(
            PhotoAlbumItem(
                storyId = command.storyId,
                imageUrl = command.s3Key,   // 실제로는 s3 key — presign GET 으로 변환해서 내려줌
                purpose = command.purpose,
                takenAt = command.takenAt,
                description = command.description,
                tagsJson = command.tagsJson,
                displayOrder = nextOrder,
            )
        )
        return PhotoResult.from(saved)
    }

    /**
     * Step 2 추억 사진 카드의 별 토글 (`PUT /photos/{photoId}/character-ref-toggle`).
     *
     *  - `on=true`  : purpose `STORYBOARD` → `BOTH`
     *  - `on=false` : purpose `BOTH` → `STORYBOARD`
     *
     * 별도 업로드된 `CHARACTER_REF` 사진은 토글 대상이 아니므로 거부.
     * `on=true` 시 max-3 검증 (CHARACTER_REF + BOTH 합산 ≤ 3).
     * Lock (첫 STORYBOARD_IMAGE 잡 시작 후) 검증.
     */
    fun toggleCharacterRef(userId: Long, storyId: Long, photoId: Long, on: Boolean): PhotoResult {
        ownedStory(userId, storyId)
        ensureStorySummaryNotStarted(storyId)
        ensureNotLocked(storyId)

        val photo = photoRepository.findById(photoId).orElseThrow {
            BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        if (photo.storyId != storyId || photo.deletedAt != null) {
            throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }

        if (on) {
            // STORYBOARD → BOTH 만 허용. 이미 BOTH 면 idempotent (변경 없이 반환).
            // CHARACTER_REF 는 별도 업로드된 reference 라 토글 대상 아님.
            when (photo.purpose) {
                PhotoPurpose.BOTH -> return PhotoResult.from(photo)
                PhotoPurpose.STORYBOARD -> {
                    ensureCharacterRefCapacity(storyId, delta = 1)
                    photo.purpose = PhotoPurpose.BOTH
                }
                PhotoPurpose.CHARACTER_REF ->
                    throw BusinessException(CommonErrorCode.INVALID_INPUT)
            }
        } else {
            // BOTH → STORYBOARD 만. 이미 STORYBOARD 면 idempotent.
            when (photo.purpose) {
                PhotoPurpose.STORYBOARD -> return PhotoResult.from(photo)
                PhotoPurpose.BOTH -> photo.purpose = PhotoPurpose.STORYBOARD
                PhotoPurpose.CHARACTER_REF ->
                    throw BusinessException(CommonErrorCode.INVALID_INPUT)
            }
        }
        return PhotoResult.from(photo)
    }

    /**
     * Story 에 속한 사진 목록 조회 (소유권 검증).
     * `display_order` 오름차순 + soft-delete 제외.
     */
    @Transactional(readOnly = true)
    fun findPhotos(userId: Long, storyId: Long): List<PhotoResult> {
        ownedStory(userId, storyId)
        return photoRepository
            .findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId)
            .map(PhotoResult::from)
    }

    /**
     * DB soft delete + S3 객체 hard delete + 남은 사진 displayOrder 0..N-1 로 compact.
     *
     * "사용자가 명시적으로 삭제한 사진" = 복구 의도 없음 으로 간주, 스토리지 낭비 방지.
     *
     * S3 삭제는 **트랜잭션 커밋 직후** 별도 리스너(`S3CleanupEventListener`)가 수행.
     * 트랜잭션 내에서 직접 호출하면 "S3 삭제 성공 → DB 커밋 실패" 시 broken image
     * (DB 에는 사진이 있지만 S3 에는 파일 없음 → NoSuchKey) 가 발생할 수 있어 event 분리.
     * 반대 실패 (DB 커밋 성공 → S3 삭제 실패) 는 orphan 만 남고 배치 정리로 복구 가능.
     *
     * displayOrder compaction (0-indexed 연속 보장):
     *  - 삭제만 하고 끝내면 [0,1,2,3] → A 삭제 → [1,2,3] 으로 갭 발생.
     *  - addPhoto 의 nextOrder = max+1 로직과 결합되면 새 업로드는 4 로 들어가 갭 영구화.
     *  - reorderPhotos 가 한 번 실행되면 자동 압축되지만, 사용자가 reorder 를 안 하면
     *    displayOrder 가 0-indexed 연속이 아닌 상태로 AI 처리 / 디버깅 시 혼란.
     *  - 따라서 삭제 트랜잭션 안에서 즉시 compact: 남은 사진 ASC 순 그대로 0..N-1 재할당.
     *  - JPA dirty checking 이라 추가 SQL UPDATE 만 발생, 별도 INSERT/DELETE 없음.
     */
    fun removePhoto(userId: Long, storyId: Long, photoId: Long) {
        ownedStory(userId, storyId)
        ensureStorySummaryNotStarted(storyId)
        val photo = photoRepository.findById(photoId).orElseThrow {
            BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        if (photo.storyId != storyId || photo.deletedAt != null) {
            throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        // CHARACTER_REF / BOTH 사진의 삭제는 reference set 변경에 해당 → lock 적용.
        // 순수 STORYBOARD 사진은 reference 와 무관하므로 lock 후에도 삭제 허용.
        if (photo.purpose == PhotoPurpose.CHARACTER_REF || photo.purpose == PhotoPurpose.BOTH) {
            ensureNotLocked(storyId)
        }
        photo.deletedAt = LocalDateTime.now()

        // 남은 활성 사진들 displayOrder 0..N-1 로 압축.
        // (deletedAt = now 가 같은 영속성 컨텍스트라 flush 시점에 따라 쿼리에 포함될 수도 있어
        //  명시적으로 photoId 필터링 — defensive.)
        photoRepository.findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId)
            .filter { it.id != photoId }
            .forEachIndexed { index, p -> p.displayOrder = index.toLong() }

        // 실제 S3 DeleteObject 는 S3CleanupEventListener 가 AFTER_COMMIT 에 수행.
        eventPublisher.publishEvent(S3DeletionEvent(photo.imageUrl))
    }

    /**
     * 사진 설명/태그 수정 (PATCH).
     * null 필드 = 미변경, 빈 문자열 = 값 비우기.
     */
    fun modifyPhoto(command: ModifyPhotoCommand): PhotoResult {
        ownedStory(command.userId, command.storyId)
        ensureStorySummaryNotStarted(command.storyId)
        val photo = photoRepository.findById(command.photoId).orElseThrow {
            BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        if (photo.storyId != command.storyId || photo.deletedAt != null) {
            throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        command.description?.let { photo.description = it }
        command.tagsJson?.let { photo.tagsJson = it }
        return PhotoResult.from(photo)
    }

    /**
     * FE 가 이미지를 실제로 로드할 수 있는 임시 URL (1시간 유효) 을 생성.
     * `findPhotos` 결과를 presentation layer 가 이 함수로 변환한다.
     */
    fun presignGetUrl(s3Key: String, ttl: Duration = Duration.ofHours(1)): String =
        s3Service.presignGetUrl(s3Key, ttl)

    /**
     * 사진 순서 일괄 변경 (PUT /photos/order).
     * `orderedPhotoIds` 는 **현재 story 의 활성 사진 전부** 를 새 순서대로 나열한 리스트여야 함.
     *
     * 검증:
     *  - 소유권: story 가 내 것인가 (`ownedStory`)
     *  - 완전성: DB 의 활성 사진 수와 입력 리스트 크기 일치 + 중복 없음
     *  - 소속: 모든 photoId 가 같은 storyId 에 속함
     *
     * 실행: 입력 순서대로 `display_order = 0, 1, 2, ...` 재할당. 단일 트랜잭션.
     */
    fun reorderPhotos(userId: Long, storyId: Long, orderedPhotoIds: List<Long>): List<PhotoResult> {
        ownedStory(userId, storyId)
        ensureStorySummaryNotStarted(storyId)

        if (orderedPhotoIds.size != orderedPhotoIds.toSet().size) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        val photos = photoRepository.findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId)
        if (photos.size != orderedPhotoIds.size) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        val byId = photos.associateBy { it.id }
        val reordered = orderedPhotoIds.map { id ->
            byId[id] ?: throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        reordered.forEachIndexed { index, photo -> photo.displayOrder = index.toLong() }
        return reordered.map(PhotoResult::from)
    }

    /**
     * 단건 조회 + 소유권 검증 공통 헬퍼 (StoryService.ownedStory 와 동일 패턴).
     */
    private fun ownedStory(userId: Long, storyId: Long): Story {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.userId != userId) throw BusinessException(CommonErrorCode.FORBIDDEN)
        return story
    }

    /**
     * "줄거리(SUMMARY) 잡이 한 번이라도 시작됐는가" 검증 — Step 1+2 lock 의 BE 측 가드.
     *
     * Step 3 의 "스토리 만들기" 가 실행되어 STORYBOARD_STORY_SUMMARY 잡이 발행되면 (PENDING/RUNNING/SUCCESS)
     * 이후 Step 4 ~ 의 모든 산출물이 그 시점의 사진/메타에 의존한다. 따라서 Step 2 mutation 전체를 막아
     * downstream 일관성을 보호한다.
     *
     * (FAILED 만 있는 상태는 줄거리 자체가 성립 안 한 것이라 허용 — 사용자가 사진을 바꾸고 다시 시도 가능.)
     *
     * NOTE: `ensureNotLocked` (CHARACTER_REF 한정 락) 와 별도로 동작.
     *  - SUMMARY 가 시작되었지만 IMAGE 잡이 아직 없는 경우 → SUMMARY lock 만 hit
     *  - IMAGE 잡까지 진입한 경우 → 두 lock 모두 hit (어느 하나가 먼저 throw 해도 결과 동일)
     */
    private fun ensureStorySummaryNotStarted(storyId: Long) {
        val existing = jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId,
            JobType.STORYBOARD_STORY_SUMMARY,
            listOf(JobStatus.PENDING, JobStatus.RUNNING, JobStatus.SUCCESS),
        )
        if (existing != null) {
            throw BusinessException(StoryErrorCode.STEP_LOCKED_BY_SUMMARY)
        }
    }

    /**
     * "대표 사진 set 이 잠겼는가" 검증 — A안 + (b) 시점.
     *
     * 첫 STORYBOARD_IMAGE 배치 잡이 한 번이라도 발행됐으면 (PENDING/RUNNING/SUCCESS)
     * AI 측 reference.png 가 이미 만들어졌거나 진행 중이므로 reference set 변경 불가.
     * (FAILED 만 있는 상태는 잡 자체가 아직 성립 안 한 거라 허용 — 사용자가 사진 바꾸고 재시도 가능.)
     */
    private fun ensureNotLocked(storyId: Long) {
        val pendingOrRunning = jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId,
            JobType.STORYBOARD_IMAGE,
            listOf(JobStatus.PENDING, JobStatus.RUNNING),
        )
        if (pendingOrRunning != null) {
            throw BusinessException(StoryErrorCode.CHARACTER_PHOTOS_LOCKED)
        }
        val success = jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
            storyId = storyId,
            jobType = JobType.STORYBOARD_IMAGE,
            status = JobStatus.SUCCESS,
        )
        if (success != null) {
            throw BusinessException(StoryErrorCode.CHARACTER_PHOTOS_LOCKED)
        }
    }

    /**
     * "이번 변경 후 reference set 이 max 3 을 넘는가" 검증.
     * `delta` = 변경 후 증가하는 개수 (toggle ON / addCharacterRef commit 모두 +1).
     *
     * AI schema 의 `characterSourceImageS3Keys: max_length=3` 와 매칭.
     */
    private fun ensureCharacterRefCapacity(storyId: Long, delta: Int) {
        val current = photoRepository.countByStoryIdAndPurposeInAndDeletedAtIsNull(
            storyId,
            listOf(PhotoPurpose.CHARACTER_REF, PhotoPurpose.BOTH),
        )
        if (current + delta > MAX_CHARACTER_PHOTOS) {
            throw BusinessException(StoryErrorCode.MAX_CHARACTER_PHOTOS_EXCEEDED)
        }
    }

    companion object {
        /** AI schema characterSourceImageS3Keys 의 max_length 와 일치. */
        private const val MAX_CHARACTER_PHOTOS = 3
    }
}
