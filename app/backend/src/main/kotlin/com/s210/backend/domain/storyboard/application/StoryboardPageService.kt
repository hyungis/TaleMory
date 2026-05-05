package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.storyboard.application.dto.StorySentenceTranslationJobMessage
import com.s210.backend.domain.storyboard.application.dto.StorySentenceTranslationRequestPayload
import com.s210.backend.domain.storyboard.application.dto.StoryboardPageResult
import com.s210.backend.domain.storyboard.application.dto.StoryboardPagesResult
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper

/**
 * 스토리보드 페이지 단위 조회 / 편집 유스케이스.
 *
 * - 페이지는 `storyboard_pages` 테이블이 단일 진실 원본.
 *   listener 가 STORY 결과 받을 때 채우고, 유저가 PATCH 로 한글 본문만 갱신할 수 있다.
 * - Step 3 (PromptStep) 은 응답을 join 해 통합 본문을 read-only 로 보여주고,
 *   Step 4 (StoryboardStep) 는 페이지별 카드로 렌더 + 페이지별 PATCH 호출.
 */
@Service
@Transactional
class StoryboardPageService(
    private val storyRepository: StoryRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val storyboardPageRepository: StoryboardPageRepository,
    private val jobRepository: StoryGenerationJobRepository,
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * `GET /api/stories/{storyId}/storyboard/pages`
     *
     * 가장 최근 storyBoard 의 페이지들을 page_number 오름차순으로 반환.
     * 줄거리가 아직 생성되지 않은 상태(storyBoard null)에선 `pages = []` 로 200 OK 응답한다.
     * (FE 가 placeholder 또는 안내 문구를 띄울 수 있도록)
     */
    @Transactional(readOnly = true)
    fun listPages(userId: Long, storyId: Long): StoryboardPagesResult {
        ownedStory(userId, storyId)

        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: return StoryboardPagesResult(storyId = storyId, pages = emptyList())

        val pages = storyboardPageRepository
            .findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)
            .map { StoryboardPageResult.from(it, objectMapper) }

        return StoryboardPagesResult(storyId = storyId, pages = pages)
    }

    /**
     * `PATCH /api/stories/{storyId}/storyboard/pages/{pageNumber}`
     *
     * 한 페이지의 한글 본문만 update. 다른 필드(english_text/scene_summary/image_prompt/image_url)는
     * AI 원본을 그대로 보존한다 — 이미지 생성 시 prompt 일관성 유지를 위해.
     *
     * - 줄거리 미생성 / 페이지 미존재 → RESOURCE_NOT_FOUND
     * - 빈 입력 (validation 으로 1차 차단되지만 trim 후 재확인) → INVALID_INPUT
     */
    fun updatePageKoreanText(
        userId: Long,
        storyId: Long,
        pageNumber: Int,
        koreanText: String,
    ): StoryboardPageResult {
        val story = ownedStory(userId, storyId)
        assertStoryboardEditable(story)
        assertNoActiveTranslationJob(storyId)

        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        val page = storyboardPageRepository.findByStoryBoardIdAndPageNumber(storyBoard.id, pageNumber)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        val trimmed = koreanText.trim()
        if (trimmed.isEmpty()) throw BusinessException(CommonErrorCode.INVALID_INPUT)

        page.replaceKoreanText(objectMapper, trimmed)
        val translationJob = publishTranslationJob(storyId, pageNumber, trimmed)
        // dirty checking 으로 트랜잭션 종료 시 자동 UPDATE.

        return StoryboardPageResult.from(page, objectMapper, translationJobId = translationJob.id)
    }

    private fun publishTranslationJob(
        storyId: Long,
        pageNumber: Int,
        koreanText: String,
    ): StoryGenerationJob {
        val payload = StorySentenceTranslationRequestPayload(
            pageNumber = pageNumber,
            koreanText = koreanText,
        )
        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.STORY_SENTENCE_TRANSLATION,
                status = JobStatus.PENDING,
                requestPayload = objectMapper.writeValueAsString(payload),
            ),
        )

        val envelope = StorySentenceTranslationJobMessage(
            jobId = job.id.toString(),
            storyId = storyId,
            pageNumber = pageNumber,
            payload = payload,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.STORY_SENTENCE_TRANSLATE,
            envelope,
        )
        log.info(
            "[SENTENCE:TRANSLATE] published jobId={}, storyId={}, pageNumber={}, koreanLen={}",
            job.id,
            storyId,
            pageNumber,
            koreanText.length,
        )
        return job
    }

    /**
     * 소유권 + 삭제 여부 검증.
     * StoryboardGenerationService 의 동명 메서드와 동일 패턴 — 향후 공통 helper 로 추출 검토.
     */
    private fun assertNoActiveTranslationJob(storyId: Long) {
        val activeTranslationJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId,
            JobType.STORY_SENTENCE_TRANSLATION,
            listOf(JobStatus.PENDING, JobStatus.RUNNING),
        )
        if (activeTranslationJob != null) {
            throw BusinessException(StoryErrorCode.STORYBOARD_TRANSLATION_IN_PROGRESS)
        }
    }

    private fun ownedStory(userId: Long, storyId: Long): Story {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.userId != userId) throw BusinessException(CommonErrorCode.FORBIDDEN)
        return story
    }

    private fun assertStoryboardEditable(story: Story) {
        if (story.stylePresetId != null) {
            throw BusinessException(StoryErrorCode.STORYBOARD_EDIT_LOCKED_BY_STYLE)
        }
    }
}
