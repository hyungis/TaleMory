package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.redis.IllustrationVersionRedisRepository
import com.s210.backend.common.redis.JobStatusRedisRepository
import com.s210.backend.common.transaction.afterCommit
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
import com.s210.backend.domain.story.infrastructure.repository.StoryVoiceAssignmentRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.story.model.StoryMode
import com.s210.backend.domain.story.model.StoryStatus
import com.s210.backend.domain.tts.application.TtsCacheService
import com.s210.backend.domain.tts.application.TtsService
import com.s210.backend.domain.tts.application.dto.StoryTtsJobMessage
import com.s210.backend.domain.tts.application.dto.StoryTtsPayload
import com.s210.backend.domain.tts.application.dto.TtsOptions
import com.s210.backend.domain.tts.application.dto.TtsSentenceItem
import com.s210.backend.domain.tts.application.dto.TtsVoiceReference
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
 *   - 멱등 응답 (이미 confirm 됐으면 기존 결과 그대로 반환 — 네트워크 retry / 사용자 새로고침 /
 *     뒤로가기 → 다시 미리보기 등 정상 흐름에서 409 가 나지 않도록)
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
    private val storyVoiceAssignmentRepository: StoryVoiceAssignmentRepository,
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
        assertNoActiveTranslationJob(storyId)
        if (story.mode != StoryMode.WEBTOON && story.voiceProfileId == null) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }

        // 2) 선행 잡 + 데이터 검증
        // 텍스트는 STORYBOARD_STORY 잡 자체가 진실 소스 — status 가 곧 신호.
        val storyJob = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY)
        if (storyJob == null || storyJob.status != JobStatus.SUCCESS) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }
        // 이미지는 배치 잡(STORYBOARD_IMAGE) status 대신 storyboard_pages.image_url 이 모두
        // 채워졌는지 직접 검증한다. 배치 잡은 한 페이지라도 FAILED 면 영구 FAILED 로 남지만,
        // 사용자가 페이지별 재생성(STORYBOARD_IMAGE_REGENERATE) 으로 image_url 을 채울 수
        // 있으므로 페이지 데이터 자체가 진짜 신호. 잡 status 만 보면 정상 보완 흐름까지
        // INVALID_STORY_STATE 로 차단되는 버그가 있었음.
        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        val pages = storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)
        if (pages.isEmpty() || pages.any { it.imageUrl.isNullOrBlank() }) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }
        // 배치 잡 ID 는 Redis 일러스트 버전 트래킹의 v1 메타데이터로 쓰임. status 는 검증에 사용 안 하지만
        // 잡 row 자체는 보통 존재 (배치 시작 시 INSERT). null 이면 트래킹 jobId 도 null.
        val imageJob = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
            storyId, JobType.STORYBOARD_IMAGE)

        // 3) 멱등 응답 — 이미 confirm 된 동화는 기존 결과를 그대로 200 으로 돌려준다.
        //
        //    "confirm 후" 의 신호는 **TTS 잡 존재** (PENDING/RUNNING/SUCCESS).
        //    Option B 적용 후 scenes/scene_sentences 는 Step 7 진입 시 prepareScenes 가 미리
        //    INSERT 하므로, scene-count 만으로는 "이미 confirm 됐는지" 판정할 수 없다.
        //    TTS 잡 발행 여부가 "confirm 통과해서 TTS 큐잉까지 갔다" 의 진짜 신호.
        //
        //    FAILED 상태는 재시도 허용 — 사용자가 Step 8 에서 재confirm 트리거 시 새 TTS 잡 발행.
        //    Step 7 → 8 진입 후 뒤로갔다가 다시 미리보기, 사용자 새로고침, 더블클릭/네트워크
        //    재시도 같은 정상 흐름에서 409 가 떨어지지 않도록 read-only 로 응답 (사이드이펙트 없음).
        val existingTtsJob = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.TTS)
        if (existingTtsJob != null && existingTtsJob.status in setOf(
                JobStatus.PENDING, JobStatus.RUNNING, JobStatus.SUCCESS,
            )
        ) {
            return assembleExistingResult(storyId)
        }

        // 4) STORY job result payload 에서 sentences 추출
        val storyResultJson = storyJob.resultPayload
            ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        val payloadTree = objectMapper.readTree(storyResultJson)
        val pagesNode = payloadTree.get("pages")
            ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)

        // page_number → sentences[] 매핑.
        //
        // 좌표는 storyboard JSON 에서 읽지 않는다 — WEBTOON 모드는 최종 삽화가 만들어진 후
        // WebtoonLayoutResultListener 가 AI Vision 결과의 anchor 좌표를 scene.character_anchors 에
        // 채우고, VIEWER 모드는 좌표를 사용하지 않는다. 여기서는 텍스트/스피커만 평탄화한다.
        data class SentenceInput(
            val englishText: String,
            val koreanText: String?,
            val speakerKey: String?,
        )
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
                            speakerKey = it.get("speakerKey")?.asText()?.takeIf(String::isNotBlank),
                        )
                    )
                }
                result
            } else emptyList()
            pageNumber to list
        }

        // 5) 최신 FINAL_ILLUSTRATION 잡의 페이지별 결과 (있으면 우선 사용).
        // (storyBoard / pages 는 step 2 에서 검증과 함께 이미 로드 — 재사용)
        val latestFinalJob = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
            storyId, JobType.FINAL_ILLUSTRATION,
        )
        val finalUrlsByPage: Map<Int, String> = latestFinalJob
            ?.takeIf { it.status == JobStatus.SUCCESS || it.status == JobStatus.RUNNING }
            ?.resultPayload
            ?.let { runCatching { parseFinalUrlMap(it) }.getOrNull() }
            ?: emptyMap()

        // 7) Scene + SceneSentence 확보.
        //
        //    Option B 적용 후엔 Step 7 의 prepareScenes 가 이미 row 를 만들어둔 상태가 정상 흐름이다.
        //    이 경우엔 INSERT 를 스킵하고 기존 row 를 그대로 사용 (FE 가 강조 녹음한 hasHighlighted 플래그도 보존).
        //    단, illustrationUrl 은 prepareScenes 시점엔 storyboard_pages.imageUrl(보통 null) 로 채워졌을 수 있으므로
        //    여기서 최신 FINAL_ILLUSTRATION 잡 결과로 보강(이미 채워져 있으면 덮어쓰지 않음).
        //
        //    Legacy fallback: prepareScenes 호출 없이 직접 confirm 이 들어온 경우 — 옛 흐름대로
        //    STORY job result payload 에서 sentences 를 파싱해 INSERT.
        var totalSentences = 0
        val existingScenes = sceneRepository.findByStoryIdOrderByPageNumberAsc(storyId)
        val createdScenes = if (existingScenes.isNotEmpty()) {
            // 기존 scene illustrationUrl 보강 — final 결과가 있으면 항상 최신으로 덮어씀.
            existingScenes.forEach { scene ->
                finalUrlsByPage[scene.pageNumber]?.let { scene.illustrationUrl = it }
            }
            totalSentences = sceneSentenceRepository.findAllBySceneIdIn(existingScenes.map { it.id }).size
            existingScenes
        } else {
            pages.map { page ->
                val scene = sceneRepository.save(
                    Scene(
                        storyId = storyId,
                        pageNumber = page.pageNumber,
                        illustrationUrl = finalUrlsByPage[page.pageNumber] ?: page.imageUrl,
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
                            speakerKey = s.speakerKey,
                            hasHighlighted = false,
                        )
                    )
                    totalSentences++
                }
                scene
            }
        }

        // 8) StoryOutro 보장
        if (storyOutroRepository.findByStoryIdAndDeletedAtIsNull(storyId) == null) {
            storyOutroRepository.save(
                StoryOutro(storyId = storyId, outroText = "", audioUrl = null, signature = null)
            )
        }

        // 9) TTS 잡 row 생성 (PENDING)
        val ttsJob = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.TTS,
                status = JobStatus.PENDING,
            )
        )

        // 10) Redis versions 초기화 — best-effort, 실패해도 응답은 정상
        createdScenes.forEach { scene ->
            val finalIllustrationUrl = finalUrlsByPage[scene.pageNumber]?.takeIf { it.isNotBlank() }
                ?: return@forEach
            try {
                illustrationVersionRedisRepository.pushVersion(
                    sceneId = scene.id,
                    version = 1,
                    url = finalIllustrationUrl,
                    prompt = null,
                    jobId = imageJob?.id,
                )
            } catch (e: Exception) {
                log.warn("Redis versions init failed for scene {}: {}", scene.id, e.message)
            }
        }

        // 11) TTS 사전 캐시 조회 — 모든 SceneSentence 에 대해
        val assignments = if (story.mode == StoryMode.WEBTOON) {
            storyVoiceAssignmentRepository.findAllByStoryIdOrderBySpeakerKeyAsc(storyId)
                .associateBy { it.speakerKey }
        } else {
            emptyMap()
        }
        val allSentences = createdScenes.flatMap { scene ->
            sceneSentenceRepository.findAllBySceneId(scene.id)
        }

        if (story.mode == StoryMode.WEBTOON) {
            val requiredSpeakerKeys = allSentences
                .map { it.speakerKey ?: DEFAULT_SPEAKER_KEY }
                .toSet()
            if (requiredSpeakerKeys.isEmpty() || !assignments.keys.containsAll(requiredSpeakerKeys)) {
                throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
            }
        }

        val defaultVoiceProfileId = story.voiceProfileId
            ?: assignments[DEFAULT_SPEAKER_KEY]?.voiceProfileId
            ?: assignments.values.firstOrNull()?.voiceProfileId
            ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        val defaultVoiceProfile = voiceProfileRepository.findById(defaultVoiceProfileId).orElseThrow {
            BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }
        val defaultReferenceSource = defaultVoiceProfile.audioUrl
            ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        val voiceProfileIds = assignments.values
            .map { it.voiceProfileId }
            .plus(defaultVoiceProfileId)
            .distinct()
        val voiceProfilesById = voiceProfileRepository.findAllById(voiceProfileIds).associateBy { it.id }

        fun voiceProfileIdFor(sentence: SceneSentence): Long =
            sentence.speakerKey?.let { assignments[it]?.voiceProfileId } ?: defaultVoiceProfileId

        var cacheHits = 0
        val missSentences = mutableListOf<TtsSentenceItem>()

        allSentences.forEach { sentence ->
            val sentenceVoiceProfileId = voiceProfileIdFor(sentence)
            val cachedUrl = try {
                ttsCacheService.lookup(sentenceVoiceProfileId, sentence.englishText)
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
                        speakerKey = sentence.speakerKey,
                    )
                )
            }
        }

        val sentenceCount = allSentences.size
        val cacheMisses = missSentences.size
        log.info(
            "[TTS:CONFIRM:CACHE] storyId={}, voiceProfileId={}, sentenceCount={}, cacheHits={}, cacheMisses={}",
            storyId, defaultVoiceProfileId, sentenceCount, cacheHits, cacheMisses,
        )

        // 12) Job status Redis HSET (best-effort) — operational sidecar (진행률 sidecar).
        try {
            jobStatusRedisRepo.setStatus(
                storyId = storyId,
                jobType = JobType.TTS,
                stage = "tts",
                progress = if (sentenceCount > 0) (cacheHits * 100 / sentenceCount) else 100,
                currentStep = "TTS 생성 중 ($cacheHits/$sentenceCount)",
            )
        } catch (e: Exception) {
            log.warn("Redis status init failed for story {}: {}", storyId, e.message)
        }

        // 13) MQ publish (cache miss 있을 때만) 또는 즉시 SUCCESS
        val finalStatus = if (cacheMisses > 0) {
            val publishStarted = System.nanoTime()
            log.info(
                "[TTS:CONFIRM:PUBLISH:START] jobId={}, storyId={}, storyMode={}, voiceProfileId={}, sentenceCount={}",
                ttsJob.id, storyId, story.mode, defaultVoiceProfileId, cacheMisses,
            )
            val missSpeakerKeys = missSentences.map { it.speakerKey ?: DEFAULT_SPEAKER_KEY }.toSet()
            val voiceRefs = missSpeakerKeys.map { speakerKey ->
                val assignedVoiceId = assignments[speakerKey]?.voiceProfileId ?: defaultVoiceProfileId
                val profile = voiceProfilesById[assignedVoiceId]
                    ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
                val referenceSource = profile.audioUrl
                    ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
                TtsVoiceReference(
                    speakerKey = speakerKey,
                    voiceId = assignedVoiceId.toString(),
                    referenceAudioUrl = referenceSource.takeUnless(::looksLikeS3Key),
                    referenceAudioS3Key = referenceSource.takeIf(::looksLikeS3Key),
                )
            }
            ttsService.publish(
                    StoryTtsJobMessage(
                        jobId = ttsJob.id.toString(),
                        storyMode = story.mode.name,
                        storyId = storyId,
                        payload = StoryTtsPayload(
                            storyId = storyId,
                            storyMode = story.mode.name,
                            voiceId = defaultVoiceProfileId.toString(),
                            referenceAudioUrl = defaultReferenceSource.takeUnless(::looksLikeS3Key),
                            referenceAudioS3Key = defaultReferenceSource.takeIf(::looksLikeS3Key),
                            voiceRefs = voiceRefs,
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
                    jobType = JobType.TTS,
                    stage = "done",
                    progress = 100,
                    currentStep = "TTS 완료 (전부 캐시 적중)",
                )
                // 즉시 SUCCESS 분기 — polling cache 도 함께 정리해 stale RUNNING 응답이 남지 않도록.
                // afterCommit: ttsJob.status = SUCCESS 가 DB 반영된 다음에 invalidate (pre-commit race 차단).
                afterCommit { jobStatusRedisRepo.invalidateJobResponse(ttsJob.id) }
            } catch (e: Exception) {
                log.warn("Redis status finalize failed: {}", e.message)
            }
            JobStatus.SUCCESS
        }

        // 14) 결과 반환
        return ConfirmStoryboardResult(
            jobId = ttsJob.id,
            jobType = "TTS",
            status = finalStatus.name,
            sceneCount = createdScenes.size,
            sentenceCount = sentenceCount,
            cacheHits = cacheHits,
            cacheMisses = cacheMisses,
            finalIllustrationJobId = latestFinalJob?.id,
        )
    }

    /**
     * 이미 confirm 된 동화의 기존 결과를 그대로 응답에 담아 돌려준다 (멱등 응답 경로).
     *
     * - sceneCount/sentenceCount 는 DB 에서 직접 카운트
     * - jobId 는 가장 최근 TTS 잡 (status 도 그 시점 값 그대로 반영)
     * - finalIllustrationJobId 는 가장 최근 FINAL_ILLUSTRATION 잡
     * - cacheHits/Misses 는 첫 confirm 때만 의미가 있어 0 으로 통일 (FE 는 표시용으로만 사용)
     */
    private fun assembleExistingResult(storyId: Long): ConfirmStoryboardResult {
        val ttsJob = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.TTS)
            ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        val finalJob = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
            storyId, JobType.FINAL_ILLUSTRATION,
        )
        val scenes = sceneRepository.findAllByStoryId(storyId)
        val sentenceCount = if (scenes.isEmpty()) 0
                            else sceneSentenceRepository.findAllBySceneIdIn(scenes.map { it.id }).size

        return ConfirmStoryboardResult(
            jobId = ttsJob.id,
            jobType = "TTS",
            status = ttsJob.status.name,
            sceneCount = scenes.size,
            sentenceCount = sentenceCount,
            cacheHits = 0,
            cacheMisses = 0,
            finalIllustrationJobId = finalJob?.id,
        )
    }

    /**
     * FINAL_ILLUSTRATION 잡 resultPayload 의 JSON `{"1":"url1","2":"url2",...}` 를
     * Map<pageNumber, imageUrl> 로 파싱. 실패 시 null 리턴 (caller 가 emptyMap 으로 폴백).
     */
    private fun parseFinalUrlMap(json: String): Map<Int, String> {
        val map = objectMapper.readValue(json, Map::class.java) as Map<*, *>
        return map.entries.mapNotNull { (k, v) ->
            val page = k?.toString()?.toIntOrNull() ?: return@mapNotNull null
            val url = v?.toString() ?: return@mapNotNull null
            page to url
        }.toMap()
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

    companion object {
        private val S3_KEY_PATTERN = Regex("^([a-z][a-z0-9-]*/)?stories/")
        private const val DEFAULT_SPEAKER_KEY = "narrator"
    }
}
