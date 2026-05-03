package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.redis.IllustrationVersionRedisRepository
import com.s210.backend.common.redis.JobStatusRedisRepository
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
import com.s210.backend.domain.tts.application.TtsCacheService
import com.s210.backend.domain.tts.application.TtsService
import com.s210.backend.domain.tts.application.dto.StoryTtsJobMessage
import com.s210.backend.domain.tts.application.dto.StoryTtsPayload
import com.s210.backend.domain.tts.application.dto.TtsOptions
import com.s210.backend.domain.tts.application.dto.TtsSentenceItem
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
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
    private val voiceProfileRepository: VoiceProfileRepository,
    private val ttsCacheService: TtsCacheService,
    private val ttsService: TtsService,
    private val jobStatusRedisRepo: JobStatusRedisRepository,
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

        // 10) TTS 사전 캐시 조회 — 모든 SceneSentence 에 대해
        val voiceProfileId = story.voiceProfileId!!
        val voiceProfile = voiceProfileRepository.findById(voiceProfileId).orElseThrow {
            BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }
        val referenceSource = voiceProfile.audioUrl
            ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)

        val allSentences = createdScenes.flatMap { scene ->
            sceneSentenceRepository.findAllBySceneId(scene.id)
        }
        var cacheHits = 0
        val missSentences = mutableListOf<TtsSentenceItem>()

        allSentences.forEach { sentence ->
            val cachedUrl = try {
                ttsCacheService.lookup(voiceProfileId, sentence.englishText)
            } catch (e: Exception) {
                log.warn("TTS cache lookup failed for sentence {}: {}", sentence.id, e.message)
                null
            }
            if (cachedUrl != null) {
                sentence.ttsAudioUrl = cachedUrl
                cacheHits++
            } else {
                missSentences.add(
                    TtsSentenceItem(
                        sentenceId = sentence.id,
                        text = sentence.englishText,
                    )
                )
            }
        }

        val sentenceCount = allSentences.size
        val cacheMisses = missSentences.size
        log.info(
            "[TTS:CONFIRM:CACHE] storyId={}, voiceProfileId={}, sentenceCount={}, cacheHits={}, cacheMisses={}",
            storyId, voiceProfileId, sentenceCount, cacheHits, cacheMisses,
        )

        // 11) Job status Redis HSET (best-effort)
        try {
            jobStatusRedisRepo.setStatus(
                storyId = storyId,
                stage = "tts",
                progress = if (sentenceCount > 0) (cacheHits * 100 / sentenceCount) else 100,
                currentStep = "TTS 생성 중 ($cacheHits/$sentenceCount)",
            )
        } catch (e: Exception) {
            log.warn("Redis status init failed for story {}: {}", storyId, e.message)
        }

        // 12) MQ publish (cache miss 있을 때만) 또는 즉시 SUCCESS
        val finalStatus = if (cacheMisses > 0) {
            val publishStarted = System.nanoTime()
            log.info(
                "[TTS:CONFIRM:PUBLISH:START] jobId={}, storyId={}, voiceProfileId={}, sentenceCount={}",
                ttsJob.id, storyId, voiceProfileId, cacheMisses,
            )
            ttsService.publish(
                    StoryTtsJobMessage(
                        jobId = ttsJob.id.toString(),
                        storyId = storyId,
                        payload = StoryTtsPayload(
                            storyId = storyId,
                            voiceId = voiceProfileId.toString(),
                            referenceAudioUrl = referenceSource.takeUnless(::looksLikeS3Key),
                            referenceAudioS3Key = referenceSource.takeIf(::looksLikeS3Key),
                            options = TtsOptions(),
                            sentences = missSentences,
                        ),
                    )
            )
            log.info(
                "[TTS:CONFIRM:PUBLISH:DONE] jobId={}, storyId={}, sentenceCount={}, elapsedMs={}",
                ttsJob.id, storyId, cacheMisses, (System.nanoTime() - publishStarted) / 1_000_000,
            )
            JobStatus.PENDING
        } else {
            // 모두 캐시 적중 — 즉시 SUCCESS
            ttsJob.status = JobStatus.SUCCESS
            ttsJob.finishedAt = java.time.LocalDateTime.now()
            try {
                jobStatusRedisRepo.setStatus(
                    storyId = storyId,
                    stage = "done",
                    progress = 100,
                    currentStep = "TTS 완료 (전부 캐시 적중)",
                )
            } catch (e: Exception) {
                log.warn("Redis status finalize failed: {}", e.message)
            }
            JobStatus.SUCCESS
        }

        // 13) 결과 반환
        return ConfirmStoryboardResult(
            jobId = ttsJob.id,
            jobType = "TTS",
            status = finalStatus.name,
            sceneCount = createdScenes.size,
            sentenceCount = sentenceCount,
            cacheHits = cacheHits,
            cacheMisses = cacheMisses,
        )
    }

    /**
     * 입력이 S3 key 인지(URL 이 아닌지) 판정.
     *
     * 허용 패턴:
     *  - 레거시 raw key: `stories/...`
     *  - env-prefixed: `local/stories/...`, `dev/stories/...`, `prod/stories/...` 등
     *
     * 단순 `contains("stories/")` 보다 좁혀 — 자유 텍스트 안에 우연히 "stories/" 가 끼어든
     * false-positive 를 차단하기 위해 path-shaped 첫 segment 만 허용.
     */
    private fun looksLikeS3Key(value: String): Boolean {
        if (value.startsWith("http://") || value.startsWith("https://")) return false
        return S3_KEY_PATTERN.containsMatchIn(value)
    }

    companion object {
        private val S3_KEY_PATTERN = Regex("^([a-z][a-z0-9-]*/)?stories/")
    }
}
