package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.s3.S3DeletionEvent
import com.s210.backend.common.s3.S3Service
import com.s210.backend.domain.story.application.dto.CreatePhotoCommand
import com.s210.backend.domain.story.application.dto.ModifyPhotoCommand
import com.s210.backend.domain.story.application.dto.PhotoResult
import com.s210.backend.domain.story.entity.PhotoAlbumItem
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.PhotoAlbumItemRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
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
) {

    /**
     * Step 2 업로드용 presigned PUT URL 발급.
     * 소유권 검증 후 `stories/{storyId}/photos/{uuid}.{ext}` 패턴 key 생성.
     */
    @Transactional(readOnly = true)
    fun presignUpload(userId: Long, storyId: Long, contentType: String): S3Service.PresignedUpload {
        ownedStory(userId, storyId)
        return s3Service.presignPhotoPutUrl(storyId, contentType)
    }

    /**
     * S3 업로드 완료 후 commit — DB 에 row 생성.
     *
     * 검증:
     *  - 소유권 (`ownedStory`)
     *  - `s3Key` prefix 가 정확히 `stories/{storyId}/photos/` 여야 함
     *    → FE 가 다른 story 의 key 를 보내서 오염시키는 것 방지.
     *  - NOTE: S3 에 실제 객체가 있는지(headObject) 는 이번 MR 에선 스킵.
     *          AWS SDK 호출 1회 추가 & 권한 요구 증가. orphan 정리는 배치로 처리 예정.
     *
     * `displayOrder` 는 현재 story 의 마지막 사진 다음 번호로 자동 부여.
     */
    fun addPhoto(command: CreatePhotoCommand): PhotoResult {
        ownedStory(command.userId, command.storyId)

        val expectedPrefix = "stories/${command.storyId}/photos/"
        if (!command.s3Key.startsWith(expectedPrefix)) {
            throw BusinessException(StoryErrorCode.INVALID_PHOTO_FORMAT)
        }

        val nextOrder = photoRepository
            .findFirstByStoryIdAndDeletedAtIsNullOrderByDisplayOrderDesc(command.storyId)
            ?.let { it.displayOrder + 1 } ?: 0L

        val saved = photoRepository.save(
            PhotoAlbumItem(
                storyId = command.storyId,
                imageUrl = command.s3Key,   // 실제로는 s3 key — presign GET 으로 변환해서 내려줌
                takenAt = command.takenAt,
                description = command.description,
                tagsJson = command.tagsJson,
                displayOrder = nextOrder,
            )
        )
        return PhotoResult.from(saved)
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
        val photo = photoRepository.findById(photoId).orElseThrow {
            BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        if (photo.storyId != storyId || photo.deletedAt != null) {
            throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
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
}
