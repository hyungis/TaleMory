package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.redis.IllustrationVersionRedisRepository
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.application.dto.ConfirmStoryboardResult
import com.s210.backend.domain.story.entity.Scene
import com.s210.backend.domain.story.entity.SceneSentence
import com.s210.backend.domain.story.entity.StoryOutro
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneSentenceRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryOutroRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.story.model.StoryStatus
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper

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
    private val storyBoardRepository: StoryBoardRepository,
    private val storyboardPageRepository: StoryboardPageRepository,
    private val sceneSentenceRepository: SceneSentenceRepository,
    private val storyOutroRepository: StoryOutroRepository,
    private val illustrationVersionRedisRepository: IllustrationVersionRedisRepository,
    private val objectMapper: ObjectMapper,
    // Task 14 에서 추가될 의존성:
    //   TtsCacheService, TtsService, JobStatusRedisRepository
) {
    private val log = LoggerFactory.getLogger(javaClass)
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

        // 4) STORY job result payload 에서 sentences 추출
        val storyResultJson = storyJob.resultPayload
            ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        val payloadTree = objectMapper.readTree(storyResultJson)
        val pagesNode = payloadTree.get("pages")
            ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)

        // page_number → sentences[] 매핑
        data class SentenceInput(val englishText: String, val koreanText: String?)
        val pageToSentences: Map<Int, List<SentenceInput>> = pagesNode.associate { node ->
            val pageNumber = node.get("pageNumber").asInt()
            val sentencesArr = node.get("sentences")
            val list: List<SentenceInput> = if (sentencesArr != null && sentencesArr.isArray) {
                val result = mutableListOf<SentenceInput>()
                for (it in sentencesArr) {
                    result.add(
                        SentenceInput(
                            englishText = it.get("englishText")?.asText() ?: "",
                            koreanText = it.get("koreanText")?.asText(),
                        )
                    )
                }
                result
            } else emptyList()
            pageNumber to list
        }

        // 5) 최신 story_board → storyboard_pages 조회
        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        val pages = storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)

        if (pages.isEmpty()) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }

        // 6) Scene + SceneSentence INSERT
        var totalSentences = 0
        val createdScenes = pages.map { page ->
            val scene = sceneRepository.save(
                Scene(
                    storyId = storyId,
                    pageNumber = page.pageNumber,
                    illustrationUrl = page.imageUrl,
                    characterAnchors = null,
                )
            )
            val sentences = pageToSentences[page.pageNumber].orEmpty()
            sentences.forEachIndexed { idx, s ->
                sceneSentenceRepository.save(
                    SceneSentence(
                        sceneId = scene.id,
                        sentenceOrder = idx + 1,
                        englishText = s.englishText,
                        koreanText = s.koreanText,
                        ttsAudioUrl = null,
                        speakerKey = null,
                        bubbleSlot = null,
                        hasHighlighted = false,
                    )
                )
                totalSentences++
            }
            scene
        }

        // 7) StoryOutro 보장
        if (storyOutroRepository.findByStoryIdAndDeletedAtIsNull(storyId) == null) {
            storyOutroRepository.save(
                StoryOutro(storyId = storyId, outroText = "", audioUrl = null, signature = null)
            )
        }

        // 8) TTS 잡 row 생성 (PENDING)
        val ttsJob = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.TTS,
                status = JobStatus.PENDING,
            )
        )

        // 9) Redis versions 초기화 — best-effort, 실패해도 응답은 정상
        createdScenes.forEach { scene ->
            try {
                illustrationVersionRedisRepository.pushVersion(
                    sceneId = scene.id,
                    version = 1,
                    url = scene.illustrationUrl ?: "",
                    prompt = null,
                    jobId = imageJob.id,
                )
            } catch (e: Exception) {
                log.warn("Redis versions init failed for scene {}: {}", scene.id, e.message)
            }
        }

        // 10) 결과 반환 — Task 14 cacheHits/cacheMisses/MQ publish 추가
        return ConfirmStoryboardResult(
            jobId = ttsJob.id,
            jobType = "TTS",
            status = JobStatus.PENDING.name,
            sceneCount = createdScenes.size,
            sentenceCount = totalSentences,
            cacheHits = 0,
            cacheMisses = totalSentences,
        )
    }
}
