package com.s210.backend.domain.tts.application

import tools.jackson.databind.ObjectMapper
import com.s210.backend.common.redis.JobStatusRedisRepository
import com.s210.backend.common.transaction.afterCommit
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneSentenceRepository
import com.s210.backend.domain.tts.application.dto.PreviewTtsResultEnvelope
import com.s210.backend.domain.tts.application.dto.StoryTtsResultEnvelope
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.LocalDateTime

/**
 * AI → BE TTS 결과 처리.
 *
 * StoryboardResultListener 의 EnvelopeTypes.TTS 분기에서 위임받음.
 * 트랜잭션은 listener 진입 메서드(@Transactional) 가 보유.
 *
 * 동작:
 *  COMPLETED:
 *    - story_generation_jobs (status=SUCCESS, costUsd, finishedAt, resultPayload)
 *    - scene_sentences.tts_audio_url 일괄 UPDATE (sceneSentenceUpdates[] 기반)
 *    - 부분 실패 (audio==null) 항목 skip + WARN
 *    - cross-story sentence_id 검증 + skip
 *  FAILED:
 *    - markFailed
 *
 * Best-effort post-DB 작업 (Redis 쓰기) 는 try/catch 로 swallow:
 *    - TtsCacheService.store (성공 항목별)
 *    - JobStatusRedisRepository.setStatus (stage=done|failed, progress=100)
 */
@Component
class TtsResultHandler(
    private val jobRepository: StoryGenerationJobRepository,
    private val sceneRepository: SceneRepository,
    private val sceneSentenceRepository: SceneSentenceRepository,
    private val ttsCacheService: TtsCacheService,
    private val jobStatusRedisRepo: JobStatusRedisRepository,
    private val previewRedis: com.s210.backend.common.redis.TtsPreviewRedisRepository,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun handle(envelope: StoryTtsResultEnvelope) {
        val started = System.nanoTime()
        val jobIdLong = envelope.jobId.toLongOrNull()
        if (jobIdLong == null) {
            log.warn("Invalid TTS jobId: {}", envelope.jobId)
            return
        }
        val job = jobRepository.findById(jobIdLong).orElse(null)
        if (job == null) {
            log.warn("Unknown TTS jobId: {}", envelope.jobId)
            return
        }
        if (job.status == JobStatus.SUCCESS || job.status == JobStatus.FAILED) {
            log.info("TTS job {} already finalized ({}), skip", job.id, job.status)
            return
        }
        log.info(
            "[TTS:RES:CONSUME] jobId={}, storyId={}, status={}",
            envelope.jobId, envelope.storyId ?: job.storyId, envelope.status,
        )

        when (envelope.status.uppercase()) {
            "COMPLETED" -> {
                handleCompleted(job, envelope)
                log.info(
                    "[TTS:RES:HANDLE:DONE] jobId={}, storyId={}, status={}, elapsedMs={}",
                    envelope.jobId, job.storyId, envelope.status, elapsedMs(started),
                )
            }
            "FAILED" -> {
                val code = envelope.error?.code ?: "UNKNOWN"
                val msg = envelope.error?.message ?: "(unknown)"
                job.status = JobStatus.FAILED
                job.errorMessage = "$code: $msg".take(65_535)
                job.finishedAt = LocalDateTime.now()
                tryUpdateRedisStatus(job.storyId, "failed", null, "$code: $msg")
                tryInvalidatePollingCache(job.id)
                log.info(
                    "[TTS:RES:HANDLE:DONE] jobId={}, storyId={}, status={}, elapsedMs={}",
                    envelope.jobId, job.storyId, envelope.status, elapsedMs(started),
                )
            }
            else -> log.warn("Unknown TTS envelope status: {}", envelope.status)
        }
    }

    fun handle(envelope: PreviewTtsResultEnvelope) {
        val started = System.nanoTime()
        val previewId = envelope.jobId
        val snapshot = previewRedis.get(previewId)
        if (snapshot == null) {
            log.warn("Unknown TTS_PREVIEW previewId: {}", previewId)
            return
        }
        if (snapshot.status == JobStatus.SUCCESS || snapshot.status == JobStatus.FAILED) {
            log.info("TTS_PREVIEW {} already finalized ({}), skip", previewId, snapshot.status)
            return
        }
        log.info(
            "[TTS_PREVIEW:RES:CONSUME] previewId={}, status={}",
            previewId, envelope.status,
        )

        when (envelope.status.uppercase()) {
            "COMPLETED" -> {
                val payload = envelope.payload
                if (payload == null) {
                    log.warn("TTS_PREVIEW COMPLETED with null payload, previewId={}", previewId)
                    previewRedis.markFailed(previewId, "PAYLOAD_MISSING", "AI 응답에 payload가 없습니다.")
                    return
                }
                previewRedis.markSuccess(previewId, payload.audioUrl)
                log.info(
                    "[TTS_PREVIEW:RES:HANDLE:DONE] previewId={}, status={}, elapsedMs={}",
                    previewId, envelope.status, elapsedMs(started),
                )
            }
            "FAILED" -> {
                val code = envelope.error?.code ?: "UNKNOWN"
                val msg = envelope.error?.message ?: "(unknown)"
                previewRedis.markFailed(previewId, code, msg)
                log.info(
                    "[TTS_PREVIEW:RES:HANDLE:DONE] previewId={}, status={}, elapsedMs={}",
                    previewId, envelope.status, elapsedMs(started),
                )
            }
            else -> log.warn("Unknown TTS_PREVIEW envelope status: {}", envelope.status)
        }
    }

    private fun handleCompleted(job: StoryGenerationJob, envelope: StoryTtsResultEnvelope) {
        val payload = envelope.payload
        if (payload == null) {
            log.warn("TTS COMPLETED with null payload, jobId={}", envelope.jobId)
            job.status = JobStatus.FAILED
            job.errorMessage = "PAYLOAD_MISSING: AI 응답에 payload가 없습니다."
            job.finishedAt = LocalDateTime.now()
            return
        }

        // 1) sceneSentenceUpdates[] 적용 — cross-story 검증 포함
        val storyId = job.storyId
        val sceneIds = sceneRepository.findAllByStoryId(storyId).map { it.id }.toSet()
        val ourSentenceIds = sceneSentenceRepository.findAllBySceneIdIn(sceneIds).map { it.id }.toSet()

        var applied = 0
        payload.sceneSentenceUpdates.forEach { upd ->
            if (upd.sentenceId !in ourSentenceIds) {
                log.warn("TTS update for sentence {} not in story {}, skip", upd.sentenceId, storyId)
                return@forEach
            }
            val sentence = sceneSentenceRepository.findById(upd.sentenceId).orElse(null)
                ?: return@forEach
            sentence.ttsAudioUrl = upd.ttsAudioUrl
            applied++
        }

        // 2) Job 마무리
        job.status = JobStatus.SUCCESS
        job.resultPayload = objectMapper.writeValueAsString(payload)
        job.costUsd = payload.usage?.costUsd?.let { BigDecimal.valueOf(it) }
        job.finishedAt = LocalDateTime.now()
        log.info(
            "TTS job {} SUCCESS — storyId={}, applied={}/{}",
            job.id, storyId, applied, payload.sceneSentenceUpdates.size,
        )

        // 3) Redis cache SET — 부분 실패 (audio==null) 및 cross-story 항목 제외
        payload.items.forEach { item ->
            if (item.sentenceId !in ourSentenceIds) return@forEach
            val audio = item.audio ?: return@forEach
            val sentence = sceneSentenceRepository.findById(item.sentenceId).orElse(null)
                ?: return@forEach
            val itemVoiceProfileId = (item.voiceId ?: payload.voiceId).toLongOrNull()
                ?: return@forEach
            val speechText = sentence.ttsText?.takeIf { it.isNotBlank() } ?: sentence.englishText
            tryStoreCache(itemVoiceProfileId, speechText, audio.audioUrl)
        }

        // 4) Redis job status (operational sidecar) + polling cache invalidate.
        tryUpdateRedisStatus(storyId, "done", 100, null)
        tryInvalidatePollingCache(job.id)
    }

    private fun tryStoreCache(vpId: Long, text: String, audioUrl: String) {
        try {
            ttsCacheService.store(vpId, text, audioUrl)
        } catch (e: Exception) {
            log.warn("TTS cache SET failed (non-fatal): {}", e.message)
        }
    }

    private fun tryUpdateRedisStatus(storyId: Long, stage: String, progress: Int?, errorMessage: String?) {
        try {
            jobStatusRedisRepo.setStatus(
                storyId = storyId,
                jobType = JobType.TTS,
                stage = stage,
                progress = progress ?: 0,
                currentStep = if (stage == "done") "TTS 완료" else "TTS 실패",
                errorMessage = errorMessage,
            )
        } catch (e: Exception) {
            log.warn("Redis job status HSET failed (non-fatal): {}", e.message)
        }
    }

    /**
     * Polling cache (String JSON) invalidate — 잡 종결 시 stale RUNNING 응답을 제거.
     * 다음 FE polling 은 cache miss → DB 종결 응답을 받고 (정책상) 다시 적재 안 함.
     *
     * **afterCommit 필수**: 호출자(`onResult`)가 `@Transactional` 안이라 이 시점엔
     * `job.status = SUCCESS/FAILED` 가 DB 미반영. 즉시 invalidate 하면 다른 스레드 polling 이
     * 미반영 DB(RUNNING)를 다시 캐시에 적재해 stale 박제 race 가 발생 — commit 후로 미룬다.
     */
    private fun tryInvalidatePollingCache(jobId: Long) {
        afterCommit {
            try {
                jobStatusRedisRepo.invalidateJobResponse(jobId)
            } catch (e: Exception) {
                log.warn("Redis polling cache invalidate failed (non-fatal): {}", e.message)
            }
        }
    }

    private fun elapsedMs(started: Long): Long =
        (System.nanoTime() - started) / 1_000_000
}
