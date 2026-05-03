package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationResultEnvelope
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.time.LocalDateTime

/**
 * AI 가 보낸 최종 일러스트 페이지 단위 결과를 처리한다.
 *
 * AI 는 페이지가 N장이면 N번 publish 한다 (페이지별 1개씩).
 * - resultPayload 에 누적: Map<pageNumber, imageUrl> 형태
 * - 모든 페이지 도착 시 status = SUCCESS
 * - scenes 가 이미 INSERT 된 상태면 즉시 illustration_url 도 UPDATE
 *   (confirm 이 final 보다 먼저 일어난 케이스 대비)
 *
 * Listener 의 @Transactional 안에서 호출되므로 별도 @Transactional 불필요.
 */
@Component
class FinalIllustrationResultHandler(
    private val jobRepository: StoryGenerationJobRepository,
    private val sceneRepository: SceneRepository,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun handleSuccess(envelope: FinalIllustrationResultEnvelope) {
        val jobId = envelope.jobId.toLongOrNull()
            ?: run {
                log.warn("[FINAL_ILLUST:RES] invalid jobId={}", envelope.jobId)
                return
            }
        val job = jobRepository.findById(jobId).orElse(null)
        if (job == null) {
            log.warn("[FINAL_ILLUST:RES] job not found id={}", jobId)
            return
        }
        // 멱등성: 이미 끝난 잡이면 무시.
        if (job.status == JobStatus.SUCCESS || job.status == JobStatus.FAILED) {
            log.info("[FINAL_ILLUST:RES] job already terminal id={} status={}", jobId, job.status)
            return
        }

        val pageNumber = envelope.pageNumber
            ?: throw BusinessException(CommonErrorCode.INVALID_INPUT)
        val imageUrl = envelope.payload?.result?.imageUrl
            ?: throw BusinessException(CommonErrorCode.INVALID_INPUT)

        // 1) resultPayload 누적.
        val accumulator = readAccumulator(job)
        accumulator[pageNumber] = imageUrl
        job.resultPayload = objectMapper.writeValueAsString(accumulator)

        val expected = expectedPageCount(job)
        if (accumulator.size >= expected) {
            job.status = JobStatus.SUCCESS
            job.finishedAt = LocalDateTime.now()
        } else {
            job.status = JobStatus.RUNNING
        }

        // 2) scenes 가 이미 있으면 즉시 update (confirm 이 먼저 발생한 케이스).
        sceneRepository.findByStoryIdAndPageNumber(job.storyId, pageNumber)?.let { scene ->
            scene.illustrationUrl = imageUrl
        }

        log.info(
            "[FINAL_ILLUST:RES] success — jobId={}, page={}/{}, status={}",
            jobId, accumulator.size, expected, job.status,
        )
    }

    fun handleFailure(envelope: FinalIllustrationResultEnvelope) {
        val jobId = envelope.jobId.toLongOrNull()
            ?: run {
                log.warn("[FINAL_ILLUST:RES] invalid jobId={}", envelope.jobId)
                return
            }
        val job = jobRepository.findById(jobId).orElse(null) ?: return
        if (job.status == JobStatus.SUCCESS || job.status == JobStatus.FAILED) return

        job.status = JobStatus.FAILED
        val code = envelope.error?.code
        val msg = envelope.error?.message
        job.errorMessage = listOfNotNull(code, msg).joinToString(": ").ifBlank { "FINAL_ILLUSTRATION_FAILED" }.take(65_535)
        job.finishedAt = LocalDateTime.now()

        log.warn("[FINAL_ILLUST:RES] failed — jobId={}, code={}, message={}",
            jobId, envelope.error?.code, envelope.error?.message)
    }

    @Suppress("UNCHECKED_CAST")
    private fun readAccumulator(job: StoryGenerationJob): MutableMap<Int, String> {
        val raw = job.resultPayload ?: return mutableMapOf()
        return try {
            val stringKeyed = objectMapper.readValue(raw, Map::class.java) as Map<*, *>
            stringKeyed.entries
                .mapNotNull { (k, v) ->
                    val intKey = k?.toString()?.toIntOrNull() ?: return@mapNotNull null
                    val strVal = v?.toString() ?: return@mapNotNull null
                    intKey to strVal
                }
                .toMap()
                .toMutableMap()
        } catch (e: Exception) {
            log.warn("[FINAL_ILLUST:RES] cannot parse accumulator JSON for job={}: {}", job.id, raw, e)
            mutableMapOf()
        }
    }

    /**
     * requestPayload (FinalIllustrationJobMeta) 의 payload.items.size 를 읽어 페이지 수 도출.
     * 파싱 실패 시 Int.MAX_VALUE 반환 → 절대 SUCCESS 로 안 빠지게 안전 가드 (실패 시 영구 RUNNING).
     */
    private fun expectedPageCount(job: StoryGenerationJob): Int {
        return try {
            val req = objectMapper.readTree(job.requestPayload)
            req.path("payload").path("items").size()
        } catch (e: Exception) {
            log.warn("[FINAL_ILLUST:RES] cannot parse expectedPageCount for jobId={}", job.id, e)
            Int.MAX_VALUE
        }
    }
}
