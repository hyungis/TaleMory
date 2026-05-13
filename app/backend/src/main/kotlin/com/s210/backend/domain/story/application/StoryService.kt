package com.s210.backend.domain.story.application

import com.s210.backend.common.codec.StoryId
import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.redis.IllustrationVersionRedisRepository
import com.s210.backend.common.redis.StoryboardPageImageVersionRedisRepository
import com.s210.backend.common.s3.S3DeletionEvent
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.application.dto.CreateStoryCommand
import com.s210.backend.domain.story.application.dto.ModifyStoryCommand
import com.s210.backend.domain.story.application.dto.StoryResult
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.preset.infrastructure.repository.BgmPresetRepository
import com.s210.backend.domain.preset.infrastructure.repository.StylePresetRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.story.model.StoryStatus
import com.s210.backend.domain.story.presentation.response.ShareLinkResponse
import com.s210.backend.domain.story.presentation.response.StoryResponse
import com.s210.backend.domain.storyboard.application.FinalIllustrationGenerationService
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.slf4j.LoggerFactory
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.LocalDateTime
import java.util.UUID

/**
 * 동화 제작 워크스페이스의 진입 스토리 (DRAFT) 를 생성/수정하는 유스케이스.
 *
 * - `addStory` : Step 1 최초 진행 시 1회 호출.
 * - `modifyStory` : BasicInfoStep 에서 뒤로가기 → 값 수정 → 다시 "사진 선택하러 가기" 시 호출.
 *                   중복 DRAFT 생성 대신 기존 row 를 업데이트해 사용자의 수정 의도를 서버에 반영한다.
 * 이후 publish / delete 같은 lifecycle 메서드는 후속 MR 에서 추가.
 */
@Service
@Transactional
class StoryService(
    private val storyRepository: StoryRepository,
    private val sceneRepository: SceneRepository,
    private val stylePresetRepository: StylePresetRepository,
    private val bgmPresetRepository: BgmPresetRepository,
    private val illustrationVersionRedisRepository: IllustrationVersionRedisRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val storyboardPageRepository: StoryboardPageRepository,
    private val storyboardPageImageVersionRepository: StoryboardPageImageVersionRedisRepository,
    private val applicationEventPublisher: ApplicationEventPublisher,
    private val objectMapper: ObjectMapper,
    private val finalIllustrationGenerationService: FinalIllustrationGenerationService,
    private val jobRepository: StoryGenerationJobRepository,
    private val voiceProfileRepository: VoiceProfileRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    /**
     * 로그인 유저의 "진행 중인 동화" 1건(최신 DRAFT) 을 반환한다.
     * 없으면 null — controller 에서 `ApiResponse(data = null)` 로 내려준다.
     * BookstoreScene 에서 "새 동화책 만들기" 클릭 시 이어서 작성 여부 결정용.
     */
    @Transactional(readOnly = true)
    fun findLatestDraft(userId: Long): StoryResult? =
        storyRepository
            .findTopByUserIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(userId, StoryStatus.DRAFT)
            ?.let(StoryResult::from)

    /**
     * 해당 동화에 Scene row 가 한 건이라도 존재하는지 — Step 7 → 8 confirmStoryboard 가
     * 한 번이라도 성공했음을 의미한다.
     *
     * "이어서 작성하기" 진입 시 FE 가 Step 6/7 의 `confirmedReadOnlyLocked` 를 BE 진실 기반으로
     * 복원하기 위해 사용한다. 크롬 종료로 sessionStorage 가 비워져도 BE 의 Scene 존재 여부로
     * 락이 유지되도록 보장.
     */
    @Transactional(readOnly = true)
    fun existsScenes(storyId: Long): Boolean =
        sceneRepository.countByStoryId(storyId) > 0

    /**
     * 기본 정보가 모두 채워진 상태로 새 동화 row 를 생성한다.
     * 상태는 무조건 DRAFT — 이후 단계에서 스토리보드/삽화/음성이 순차적으로 붙는다.
     */
    fun addStory(command: CreateStoryCommand): StoryResult =
        storyRepository.save(
            Story(
                userId = command.userId,
                title = command.title,
                difficulty = command.difficulty,
                mode = command.mode,
                status = StoryStatus.DRAFT,
                companionsJson = command.companionsJson,
                mainCharacterJson = command.mainCharacterJson,
                travelPlace = command.travelPlace,
                travelStartDate = command.travelStartDate,
                travelEndDate = command.travelEndDate,
            ),
        ).let(StoryResult::from)

    /**
     * 기존 DRAFT 스토리의 step 1 필드를 부분 업데이트한다.
     *  - 소유권 검증: 다른 유저 리소스면 403 FORBIDDEN
     *  - 존재하지 않음: 404 STORY_NOT_FOUND
     *  - `ModifyStoryCommand` 의 null 필드는 "미변경" 으로 취급 (PATCH semantics).
     */
    fun modifyStory(userId: Long, storyId: Long, command: ModifyStoryCommand): StoryResult {
        val story = ownedStory(userId, storyId)
        // Step 1 락 — 줄거리(SUMMARY) 가 한 번이라도 시작됐으면 Step 1 메타 변경 차단.
        // PhotoService 와 동일한 가드 (BE STORY_022). FAILED 만 있으면 통과 — 사용자가 메타 바꾸고 재시도 가능.
        ensureStorySummaryNotStarted(storyId)
        command.title?.let { story.title = it }
        command.difficulty?.let { story.difficulty = it }
        command.companionsJson?.let { story.companionsJson = it }
        command.mainCharacterJson?.let { story.mainCharacterJson = it }
        command.travelPlace?.let { story.travelPlace = it }
        command.travelStartDate?.let { story.travelStartDate = it }
        command.travelEndDate?.let { story.travelEndDate = it }
        return StoryResult.from(story)
    }

    /**
     * "줄거리(SUMMARY) 잡이 한 번이라도 시작됐는가" 검증 — Step 1 lock 의 BE 측 가드.
     *
     * Step 3 의 "스토리 만들기" 가 실행되어 STORYBOARD_STORY_SUMMARY 잡이 발행되면 (PENDING/RUNNING/SUCCESS)
     * 이후 단계가 그 시점의 메타에 의존한다. Step 1 메타(제목/주인공/여행지 등) 변경을 막아 downstream
     * 일관성을 보호한다. (FAILED 만 있는 상태는 줄거리 자체가 성립 안 한 것이라 허용.)
     *
     * NOTE: PhotoService.ensureStorySummaryNotStarted 와 같은 패턴 (Step 1·2 lock 묶음).
     *  - SUMMARY 가 시작되면 Step 1·2 모두 동일한 STORY_022 로 거부.
     *  - 두 서비스가 같은 helper 를 정의하지만 직접 의존하면 복잡해져 각자 보유.
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
     * 소프트 삭제. "새로 시작하기" 선택 시 기존 DRAFT 를 정리하기 위해 호출한다.
     * deleted_at 을 찍어 GET /draft 조회에서 제외되도록 한다 (DB 에는 row 유지).
     */
    fun removeStory(userId: Long, storyId: Long) {
        val story = ownedStory(userId, storyId)
        story.deletedAt = LocalDateTime.now()
    }

    /**
     * 내 동화 목록 조회. soft-delete 제외, 최신순.
     * Scene 정보를 벌크 로딩해 sceneCount / coverImageUrl 을 포함한다.
     */
    @Transactional(readOnly = true)
    fun findStories(userId: Long): List<StoryResponse> {
        val stories = storyRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
        if (stories.isEmpty()) return emptyList()

        val storyIds = stories.map { it.id }
        val scenesByStory = sceneRepository
            .findByStoryIdInOrderByStoryIdAscPageNumberAsc(storyIds)
            .groupBy { it.storyId }

        return stories.map { story ->
            val scenes = scenesByStory[story.id].orEmpty()
            StoryResponse(
                id = StoryId(story.id),
                title = story.title,
                difficulty = story.difficulty.name,
                mode = story.mode.name,
                status = story.status.name,
                isBookmarked = story.isBookmarked,
                travelPlace = story.travelPlace,
                travelStartDate = story.travelStartDate,
                travelEndDate = story.travelEndDate,
                publishedAt = story.publishedAt,
                createdAt = story.createdAt,
                sceneCount = scenes.size,
                coverImageUrl = scenes.firstOrNull()?.illustrationUrl,
                shareToken = story.shareToken,
            )
        }
    }

    /**
     * 동화 공개(출판). DRAFT → PUBLISHED 전환 + shareToken 발급.
     */
    fun publishStory(userId: Long, storyId: Long): ShareLinkResponse {
        val story = ownedStory(userId, storyId)
        if (story.status == StoryStatus.PUBLISHED) {
            return ShareLinkResponse(
                shareToken = story.shareToken!!,
                shareUrl = "/shared/${story.shareToken}",
            )
        }
        story.status = StoryStatus.PUBLISHED
        story.publishedAt = LocalDateTime.now()
        if (story.shareToken == null) {
            story.shareToken = UUID.randomUUID().toString().replace("-", "")
        }

        // Redis illust versions 정리 (best-effort)
        try {
            val scenes = sceneRepository.findAllByStoryId(storyId)
            scenes.forEach { illustrationVersionRedisRepository.deleteAll(it.id) }
        } catch (e: Exception) {
            log.warn("Redis illust cleanup failed on publish storyId={}: {}", storyId, e.message)
        }

        // Step 4 storyboard-image 버전 정리 — 비선택 versioned S3 객체 + Redis 트리오 삭제.
        // 선택된 버전의 URL 은 storyboard_pages.image_url 에 영구 보존되므로 안전.
        cleanupStoryboardPageVersions(storyId, deleteAllVersions = false)

        return ShareLinkResponse(
            shareToken = story.shareToken!!,
            shareUrl = "/shared/${story.shareToken}",
        )
    }

    /**
     * DRAFT 만료 배치 잡 진입점.
     *
     * - cutoff 기준: 보통 `now - 3d` (createdAt + 3d 정책).
     * - 처리 범위:
     *   1) `status != PUBLISHED AND deletedAt IS NULL AND createdAt < cutoff` 인 row 검색.
     *   2) 각 스토리 페이지별 storyboard-image 모든 버전 + Redis 키 트리오 정리.
     *      (publishStory 와 달리 selected 도 같이 삭제 — 스토리가 통째로 버려지므로.)
     *   3) Story.deletedAt = now (soft-delete).
     *
     * 반환: 만료 처리된 row 수 (잡 로깅용).
     *
     * NOTE: 같은 트랜잭션 안에서 전체 작업이 실행된다. 만료 대상이 매우 많아지면
     *       chunk 분할이 필요하지만, 현재 사용자/스토리 규모에선 한 번에 처리해도 충분.
     */
    fun expireDrafts(cutoff: LocalDateTime): Int {
        val expired = storyRepository
            .findByStatusNotAndDeletedAtIsNullAndCreatedAtBefore(StoryStatus.PUBLISHED, cutoff)
        if (expired.isEmpty()) return 0

        val now = LocalDateTime.now()
        expired.forEach { story ->
            cleanupStoryboardPageVersions(story.id, deleteAllVersions = true)
            story.deletedAt = now
        }
        log.info(
            "Expired DRAFT stories cleanup — count={}, cutoff={}",
            expired.size, cutoff,
        )
        return expired.size
    }

    /**
     * 스토리보드 페이지별 image versioning cleanup.
     *
     * 수행:
     *  1) storyBoard → 페이지 list 조회. 페이지 없으면 즉시 종료.
     *  2) 각 페이지마다:
     *     - Redis listVersions / getCurrent 로 버전 메타 조회.
     *     - 정책에 따라 삭제 대상 버전 결정:
     *         · `deleteAllVersions = true` → Redis 의 모든 버전 (없으면 v1 만 — 배치본 보존되지 않은 상태).
     *         · `deleteAllVersions = false` → 현재 선택 (current) 을 제외한 나머지 모두.
     *     - 삭제 대상 각 버전 → `S3DeletionEvent` publish (key 는 deterministic pattern 으로 derive).
     *     - Redis 트리오 (versions / current / max-version) `deleteAll(pageId)`.
     *
     * 이벤트 publish 후 실제 S3 삭제는 `S3CleanupEventListener` 가 `AFTER_COMMIT` 단계에 수행한다.
     * 따라서 트랜잭션 롤백 시 S3 객체는 그대로 보존 — 원자성 안전.
     */
    private fun cleanupStoryboardPageVersions(storyId: Long, deleteAllVersions: Boolean) {
        val storyBoard = storyBoardRepository
            .findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId) ?: return
        val pages = storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)
        if (pages.isEmpty()) return

        pages.forEach { page ->
            val versionsInRedis = readVersionNumbers(page.id)
            val current = runCatching { storyboardPageImageVersionRepository.getCurrent(page.id) }
                .getOrNull()

            val versionsToDelete: List<Int> = when {
                // 만료 — Redis 가 비어있어도 배치본(v1) 은 S3 에 있을 수 있으므로 폴백.
                deleteAllVersions -> versionsInRedis.ifEmpty { listOf(1) }
                // publish — current(선택본) 만 보존, 나머지 versioned 객체 삭제.
                else -> versionsInRedis.filter { it != current }
            }.distinct()

            versionsToDelete.forEach { v ->
                applicationEventPublisher.publishEvent(
                    S3DeletionEvent(storyboardImageS3Key(storyId, page.pageNumber, v)),
                )
            }

            // Redis 키 트리오 삭제 — best-effort (Redis 장애 시 TTL 4d 폴백 작동).
            runCatching { storyboardPageImageVersionRepository.deleteAll(page.id) }
                .onFailure { e ->
                    log.warn(
                        "Redis storyboard-image cleanup failed pageId={}: {}",
                        page.id, e.message,
                    )
                }
        }
    }

    /**
     * Redis versions 리스트 (JSON 배열) 에서 version 번호만 추출.
     * 손상된 entry 는 skip — 전체 cleanup 실패 방지.
     */
    private fun readVersionNumbers(pageId: Long): List<Int> {
        val raw = runCatching { storyboardPageImageVersionRepository.listVersions(pageId) }
            .getOrElse { return emptyList() }
        return raw.mapNotNull { json ->
            try {
                objectMapper.readTree(json).get("version")?.asInt()
            } catch (_: Exception) {
                null
            }
        }
    }

    /**
     * versioned storyboard-image S3 key — AI 워커가 사용하는 deterministic pattern 과 동일.
     * (`app/ai/app/services/storyboard_image_service.py::_storyboard_image_object_path`)
     */
    private fun storyboardImageS3Key(storyId: Long, pageNumber: Int, version: Int): String =
        "stories/$storyId/storyboard-image/$pageNumber/v$version.png"

    /**
     * 공유 링크 조회. PUBLISHED 상태가 아니면 409.
     * shareToken 이 아직 없으면 자동 발급.
     */
    fun findShareLink(userId: Long, storyId: Long): ShareLinkResponse {
        val story = ownedStory(userId, storyId)
        if (story.status != StoryStatus.PUBLISHED) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }
        if (story.shareToken == null) {
            story.shareToken = UUID.randomUUID().toString().replace("-", "")
        }
        return ShareLinkResponse(
            shareToken = story.shareToken!!,
            shareUrl = "/shared/${story.shareToken}",
        )
    }

    /**
     * 삽화 스타일 프리셋 선택. Story.stylePresetId 를 갱신한다.
     */
    fun modifyBookmark(userId: Long, storyId: Long, isBookmarked: Boolean) {
        val story = ownedStory(userId, storyId)
        story.isBookmarked = isBookmarked
    }

    fun modifyBgm(userId: Long, storyId: Long, bgmPresetId: Long?) {
        val story = ownedStory(userId, storyId)
        if (bgmPresetId != null && !bgmPresetRepository.existsById(bgmPresetId)) {
            throw BusinessException(StoryErrorCode.BGM_PRESET_NOT_FOUND)
        }
        story.bgmPresetId = bgmPresetId
    }

    /**
     * @return Step 5 직후 백그라운드 enqueue 된 FINAL_ILLUSTRATION 잡 id
     *         (같은 stylePresetId 재선택 시 멱등 가드로 기존 jobId 반환).
     */
    fun modifyStyle(userId: Long, storyId: Long, stylePresetId: Long): Long {
        val story = ownedStory(userId, storyId)
        if (!stylePresetRepository.existsById(stylePresetId)) {
            throw BusinessException(StoryErrorCode.STYLE_PRESET_NOT_FOUND)
        }
        story.stylePresetId = stylePresetId
        return finalIllustrationGenerationService.enqueue(storyId, stylePresetId)
    }

    /**
     * 보이스 프로필을 동화에 연결한다 — Step 5 보이스 클론 commit/load 직후 호출.
     *
     * Story.voiceProfileId 는 StoryConfirmService 가 Step 7 → 8 진입 시 필수로 검증한다
     * (없으면 INVALID_STORY_STATE/409). 즉 confirm 전까지 반드시 한 번 채워져야 한다.
     *
     * 가드:
     *  - 동화 소유권: 다른 유저면 403 FORBIDDEN
     *  - 동화 상태: DRAFT 가 아니면 409 INVALID_STORY_STATE — PUBLISHED 동화의 보이스 교체 차단
     *  - 보이스 프로필 존재 + soft-delete 미반영: 404 VOICE_010
     *  - 보이스 프로필 소유권: 다른 유저 소유면 403 VOICE_011
     */
    fun modifyVoiceProfile(userId: Long, storyId: Long, voiceProfileId: Long) {
        val story = ownedStory(userId, storyId)
        if (story.status != StoryStatus.DRAFT) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }
        val voiceProfile = voiceProfileRepository.findByIdAndDeletedAtIsNull(voiceProfileId)
            ?: throw BusinessException(VoiceErrorCode.NOT_FOUND)
        if (voiceProfile.userId != userId) {
            throw BusinessException(VoiceErrorCode.FORBIDDEN)
        }
        story.voiceProfileId = voiceProfileId
    }

    /**
     * 단건 조회 + 소유권 검증 공통 헬퍼.
     *  - 존재하지 않음 → 404 STORY_NOT_FOUND
     *  - 다른 유저의 리소스 → 403 FORBIDDEN
     */
    private fun ownedStory(userId: Long, storyId: Long): Story {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) {
            throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.userId != userId) {
            throw BusinessException(CommonErrorCode.FORBIDDEN)
        }
        return story
    }
}
