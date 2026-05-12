package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.domain.story.entity.SceneSentence
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneSentenceRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.storyboard.application.dto.ChildInfo
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationLayoutBatchMessage
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationLayoutBatchPayload
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationLayoutItemMessage
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationLayoutItemPayload
import com.s210.backend.domain.storyboard.application.dto.LayoutSentenceInput
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Service
import tools.jackson.databind.ObjectMapper

/**
 * WEBTOON 모드 좌표 추출 publish 어댑터.
 *
 * 두 진입점:
 *  1. [publishBatch] — 최종 삽화 잡이 모든 페이지 도착하고 SUCCESS 마감 직전 호출.
 *     storyboard_pages + scenes/scene_sentences + Story 메타를 합쳐 fan-out 페이로드 N장을
 *     한 번에 batch 큐로 publish. AI 워커가 ThreadPoolExecutor 로 페이지별 fan-out 처리.
 *  2. [publishItem] — 부분 실패 페이지 또는 사용자 수동 재시도 한 페이지를 단건 큐로 publish.
 *
 * 호출자 (FinalIllustrationResultHandler / WebtoonLayoutRetryService) 의 트랜잭션 내부에서
 * 호출되므로 별도 @Transactional 불필요. publish 자체는 사이드 이펙트 (RabbitMQ) 라 트랜잭션
 * commit 후 도착하도록 호출 측에서 afterCommit 으로 감싸도 무방.
 */
@Service
class WebtoonLayoutPublisher(
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
    private val storyRepository: StoryRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val storyboardPageRepository: StoryboardPageRepository,
    private val sceneRepository: SceneRepository,
    private val sceneSentenceRepository: SceneSentenceRepository,
    private val storyParticipantParser: StoryParticipantParser,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * 모든 페이지 분의 좌표 추출 batch 를 publish.
     *
     * @param storyId 대상 동화.
     * @param finalIllustrationJobId  좌표 결과 envelope 의 jobId 로 사용 — Option A: FINAL_ILLUSTRATION
     *                                잡 ID 와 동일.
     * @param pageImageUrlOverrides   key=pageNumber, value=imageUrl. handler 가 누적한 최신 URL 을
     *                                넘겨주면 scenes 가 아직 갱신되지 않은 race 도 안전.
     */
    fun publishBatch(
        storyId: Long,
        finalIllustrationJobId: Long,
        pageImageUrlOverrides: Map<Int, String>,
    ) {
        val items = buildItems(storyId, pageImageUrlOverrides)
        if (items.isEmpty()) {
            log.warn("[LAYOUT:PUB] no items to publish for storyId={}", storyId)
            return
        }
        val envelope = FinalIllustrationLayoutBatchMessage(
            jobId = finalIllustrationJobId.toString(),
            storyId = storyId,
            payload = FinalIllustrationLayoutBatchPayload(items = items),
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.FINAL_ILLUSTRATION_LAYOUT,
            envelope,
        )
        log.info(
            "[LAYOUT:PUB] batch published — jobId={}, storyId={}, items={}",
            finalIllustrationJobId, storyId, items.size,
        )
    }

    /**
     * 단일 페이지 좌표 추출 publish (부분 실패 자동 재시도 또는 사용자 수동 재시도).
     *
     * @param trackingJobId  단건 publish 의 결과 envelope.jobId 로 사용. 자동 재시도 케이스는
     *                       원래 FINAL_ILLUSTRATION 잡 id 를 그대로 주고, 사용자 수동 재시도는
     *                       WEBTOON_LAYOUT_RETRY 잡 id 를 새로 만들어 넘긴다.
     */
    fun publishItem(
        storyId: Long,
        trackingJobId: Long,
        pageNumber: Int,
        pageImageUrlOverride: String? = null,
    ) {
        val item = buildItem(storyId, pageNumber, pageImageUrlOverride)
        val envelope = FinalIllustrationLayoutItemMessage(
            jobId = trackingJobId.toString(),
            storyId = storyId,
            payload = item,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.FINAL_ILLUSTRATION_LAYOUT_ITEM,
            envelope,
        )
        log.info(
            "[LAYOUT:PUB] item published — jobId={}, storyId={}, page={}",
            trackingJobId, storyId, pageNumber,
        )
    }

    // ------------------------------------------------------------------
    // payload 빌더 — DB 에서 children/scenes/sentences 를 모아 페이지별 페이로드 조립.
    // ------------------------------------------------------------------

    private fun buildItems(
        storyId: Long,
        pageImageUrlOverrides: Map<Int, String>,
    ): List<FinalIllustrationLayoutItemPayload> {
        val story = storyRepository.findById(storyId).orElse(null) ?: return emptyList()
        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        val companions = storyParticipantParser.parseCompanions(story.companionsJson)

        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: return emptyList()
        val pages = storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)
        if (pages.isEmpty()) return emptyList()

        val scenes = sceneRepository.findByStoryIdOrderByPageNumberAsc(storyId)
        val sentencesByScene = if (scenes.isEmpty()) {
            emptyMap()
        } else {
            sceneSentenceRepository.findAllBySceneIdIn(scenes.map { it.id })
                .groupBy { it.sceneId }
        }
        val sentencesByPage: Map<Int, List<SceneSentence>> = scenes
            .associate { it.pageNumber to (sentencesByScene[it.id].orEmpty()) }

        return pages
            // page 0 (표지) 는 좌표 추출 대상에서 제외 — sentence 가 없어 anchor 매칭 불가.
            .filter { it.pageNumber > 0 }
            .map { page ->
                val imageUrl = pageImageUrlOverrides[page.pageNumber] ?: page.imageUrl
                buildItemPayload(
                    page = page,
                    children = children,
                    companions = companions,
                    sentences = sentencesByPage[page.pageNumber].orEmpty(),
                    imageUrl = imageUrl,
                )
            }
    }

    private fun buildItem(
        storyId: Long,
        pageNumber: Int,
        pageImageUrlOverride: String?,
    ): FinalIllustrationLayoutItemPayload {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        val companions = storyParticipantParser.parseCompanions(story.companionsJson)

        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val page = storyboardPageRepository.findByStoryBoardIdAndPageNumber(storyBoard.id, pageNumber)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        val scene = sceneRepository.findByStoryIdAndPageNumber(storyId, pageNumber)
        val sentences = scene?.let {
            sceneSentenceRepository.findAllBySceneIdIn(listOf(it.id))
        }.orEmpty()

        return buildItemPayload(
            page = page,
            children = children,
            companions = companions,
            sentences = sentences,
            imageUrl = pageImageUrlOverride ?: page.imageUrl,
        )
    }

    private fun buildItemPayload(
        page: com.s210.backend.domain.story.entity.StoryboardPage,
        children: List<ChildInfo>,
        companions: List<String>,
        sentences: List<SceneSentence>,
        imageUrl: String?,
    ): FinalIllustrationLayoutItemPayload {
        val charactersInScene = page.charactersInSceneJson
            ?.let { runCatching { parseCharactersInScene(it) }.getOrNull() }
            .orEmpty()
        return FinalIllustrationLayoutItemPayload(
            pageNumber = page.pageNumber,
            imageUrl = imageUrl,
            imageS3Key = null,
            sceneSummary = page.sceneSummary,
            imagePrompt = page.imagePrompt,
            children = children,
            charactersInScene = charactersInScene,
            companions = companions,
            // NARRATION 문장은 BE 가 자체적으로 (0.5, 0.05) 를 주입하므로 AI 호출 비용 절감 차원에서
            // 굳이 보내지 않는다. DIALOGUE 만 보내면 AI 가 그 캐릭터 anchor 만 추출.
            sentences = sentences
                .filter { !it.speakerKey.isNullOrBlank() }
                .map { s ->
                    LayoutSentenceInput(
                        sentenceOrder = s.sentenceOrder,
                        englishText = s.englishText,
                        koreanText = s.koreanText,
                        speakerKey = s.speakerKey,
                    )
                },
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun parseCharactersInScene(json: String): List<Map<String, Any?>> {
        val parsed = objectMapper.readValue(json, List::class.java) as List<*>
        return parsed.filterIsInstance<Map<*, *>>().map { it as Map<String, Any?> }
    }
}
