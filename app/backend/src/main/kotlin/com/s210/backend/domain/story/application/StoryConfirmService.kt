package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.application.dto.ConfirmStoryboardResult
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.StoryStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Step 7 → Step 8 진입 시점에 호출되는 confirm.
 *
 * 책임:
 *   - 선행 단계 완료 검증 (DRAFT, voice clone, STORY/IMAGE job SUCCESS, storyboard_pages 존재)
 *   - 멱등성 가드 (이미 confirm 됐는지)
 *   - storyboard_pages → Scene + SceneSentence 변환 (Task 12)
 *   - Redis illust versions 초기화 (Task 13)
 *   - TTS 사전 캐시 + MQ publish (Task 14)
 *
 * 트랜잭션: 변환 + Job INSERT 까지가 @Transactional. Redis 쓰기와 MQ publish 는
 * commit 후 best-effort.
 */
@Service
class StoryConfirmService(
    private val storyRepository: StoryRepository,
    private val sceneRepository: SceneRepository,
    private val jobRepository: StoryGenerationJobRepository,
    // Task 12-14 에서 추가될 의존성:
    //   StoryBoardRepository, StoryboardPageRepository,
    //   SceneSentenceRepository, StoryOutroRepository,
    //   VoiceProfileRepository, ObjectMapper,
    //   TtsCacheService, TtsService,
    //   IllustrationVersionRedisRepository, JobStatusRedisRepository
) {
    @Transactional
    fun confirmStoryboard(storyId: Long, userId: Long): ConfirmStoryboardResult {
        // 1) Story row 락 + 소유권/상태 검증
        val story = storyRepository.findByIdAndUserId(storyId, userId)
            ?: throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.status != StoryStatus.DRAFT) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }
        if (story.voiceProfileId == null) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }

        // 2) 선행 잡 SUCCESS 검증
        val storyJob = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY)
        if (storyJob == null || storyJob.status != JobStatus.SUCCESS) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }
        val imageJob = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
            storyId, JobType.STORYBOARD_IMAGE)
        if (imageJob == null || imageJob.status != JobStatus.SUCCESS) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }

        // 3) 멱등성 가드 — 이미 confirm 됐는지
        if (sceneRepository.countByStoryId(storyId) > 0) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }

        // 4) Task 12 에서 변환 로직, Task 13 Redis, Task 14 TTS 발행 추가.
        TODO("conversion + redis + tts publish — Task 12-14")
    }
}
