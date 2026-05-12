package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.redis.IllustrationVersionRedisRepository
import com.s210.backend.common.redis.JobStatusRedisRepository
import com.s210.backend.common.transaction.afterCommit
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.story.application.HighlightOutroService
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.StoryMode
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
    private val jobStatusRedisRepo: JobStatusRedisRepository,
    private val illustrationVersionRedisRepository: IllustrationVersionRedisRepository,
    private val storyRepository: StoryRepository,
    private val webtoonLayoutPublisher: WebtoonLayoutPublisher,
    private val highlightOutroService: HighlightOutroService,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun handleSuccess(envelope: FinalIllustrationResultEnvelope) {
        val jobId = envelope.jobId.toLongOrNull()
            ?: run {
                log.warn("[FINAL_ILLUST:RES] invalid jobId={}", envelope.jobId)
                return
            }
        // PESSIMISTIC_WRITE 락 — 멀티 pod 에서 같은 잡의 다른 페이지 결과가 동시에 도착해도
        // read-modify-write of resultPayload 가 직렬화되어 누락 page 가 안 생기도록 보장.
        val job = jobRepository.findByIdForUpdate(jobId)
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

        // 1) resultPayload 누적 (lock 보호 하에 read-modify-write 안전).
        //    full payload 는 String→Any? 로 page 결과("1"="url", ...) + WEBTOON 메타("_layoutPublished" 등)
        //    를 함께 들고 다닌다. readAccumulator 는 toIntOrNull 필터로 메타 키를 자동 무시.
        val fullPayload = readFullPayload(job).toMutableMap()
        fullPayload[pageNumber.toString()] = imageUrl
        val accumulator = pageEntriesOnly(fullPayload)

        val expected = expectedPageCount(job)
        val allPagesReady = accumulator.size >= expected

        // 2) WEBTOON 모드 분기 — 모든 페이지 도착 시점에 좌표 추출 batch 를 publish 하고 잡은 RUNNING 유지.
        //    실제 SUCCESS 는 WebtoonLayoutResultListener 가 모든 페이지 좌표를 받은 후 마감.
        //    멱등 가드: `_layoutPublished` 가 true 면 이미 publish 된 잡 — 중복 publish 안 함.
        val story = storyRepository.findById(job.storyId).orElse(null)
        val isWebtoon = story?.mode == StoryMode.WEBTOON
        val alreadyLayoutPublished = fullPayload[META_LAYOUT_PUBLISHED] == true

        if (allPagesReady) {
            if (isWebtoon && !alreadyLayoutPublished) {
                fullPayload[META_LAYOUT_PUBLISHED] = true
                job.status = JobStatus.RUNNING

                // 좌표 batch publish 직전에 scenes/scene_sentences 영속화 보장.
                // 사용자가 Step 7(prepareScenes) 진입 전에 final illustration 결과가 모두 도착하면
                // scenes 가 비어있어 layout 결과 핸들러가 `scene not found` 로 anchor 저장 못 하는
                // race 가 발생. 여기서 같은 트랜잭션 안에 scenes 를 INSERT 해두면 afterCommit
                // 으로 publish 된 layout 결과가 도착할 때 항상 scene lookup 성공.
                // ensurePrepared 는 멱등 — Step 7 에서 이미 만들었어도 안전.
                runCatching { highlightOutroService.ensurePrepared(job.storyId) }
                    .onSuccess { result ->
                        log.info(
                            "[FINAL_ILLUST:RES] scenes ensured before layout publish — jobId={}, storyId={}, scenes={}, sentences={}, alreadyPrepared={}",
                            job.id, job.storyId, result.sceneCount, result.sentenceCount, result.alreadyPrepared,
                        )
                    }
                    .onFailure { e ->
                        // scenes 영속화 실패 시 layout publish 도 의미 없음 — 잡을 RUNNING 유지하고
                        // (사용자가 Step 7 수동 진입 시 prepareScenes 가 다시 시도) layout publish 만 스킵.
                        log.error(
                            "[FINAL_ILLUST:RES] ensurePrepared failed jobId={} storyId={}: {}",
                            job.id, job.storyId, e.message, e,
                        )
                        job.resultPayload = objectMapper.writeValueAsString(fullPayload.also {
                            it.remove(META_LAYOUT_PUBLISHED)
                        })
                        return
                    }

                // afterCommit 으로 미뤄 — DB 미반영 상태에서 publish 했다가 결과 envelope 가 빠르게
                // 돌아와 lock 충돌 / 중복 publish 가능성을 닫는다. resultPayload 의 `_layoutPublished`
                // 는 같은 tx 에서 commit 되므로 중복 success 콜백은 위 멱등 가드로 차단.
                //
                // 분기:
                //  - expected == 1 → revise (단일 페이지 재생성). publishItem 으로 한 장만 좌표 재추출.
                //  - expected >  1 → 배치 generate. publishBatch 로 모든 페이지 fan-out.
                val finalJobId = job.id
                val finalStoryId = job.storyId
                val pageImageUrls = accumulator.toMap()
                val isReviseFlow = expected == 1
                val singlePageNumber = pageImageUrls.keys.singleOrNull()
                afterCommit {
                    runCatching {
                        if (isReviseFlow && singlePageNumber != null) {
                            webtoonLayoutPublisher.publishItem(
                                storyId = finalStoryId,
                                trackingJobId = finalJobId,
                                pageNumber = singlePageNumber,
                                pageImageUrlOverride = pageImageUrls[singlePageNumber],
                            )
                        } else {
                            webtoonLayoutPublisher.publishBatch(
                                storyId = finalStoryId,
                                finalIllustrationJobId = finalJobId,
                                pageImageUrlOverrides = pageImageUrls,
                            )
                        }
                    }.onFailure { e ->
                        log.error("[LAYOUT:PUB] publish failed jobId={}: {}", finalJobId, e.message, e)
                    }
                }
                log.info(
                    "[FINAL_ILLUST:RES] WEBTOON layout publish queued — jobId={}, pages={}, revise={}",
                    job.id, accumulator.size, isReviseFlow,
                )
            } else {
                job.status = JobStatus.SUCCESS
                job.finishedAt = LocalDateTime.now()
                tryInvalidatePollingCache(job.id)
            }
        } else {
            job.status = JobStatus.RUNNING
        }
        job.resultPayload = objectMapper.writeValueAsString(fullPayload)

        // 2) scenes 가 이미 있으면 즉시 update (confirm 이 먼저 발생한 케이스).
        sceneRepository.findByStoryIdAndPageNumber(job.storyId, pageNumber)?.let { scene ->
            scene.illustrationUrl = imageUrl
            if (job.sceneId == null || job.sceneId == scene.id) {
                val versionMeta = if (job.sceneId == null) {
                    ReviseVersionMeta(version = 1, prompt = null)
                } else {
                    readReviseVersionMeta(job)
                }
                illustrationVersionRedisRepository.pushVersion(
                    sceneId = scene.id,
                    version = versionMeta.version ?: (illustrationVersionRedisRepository.getCurrent(scene.id) ?: 1),
                    url = imageUrl,
                    prompt = versionMeta.prompt,
                    jobId = job.id,
                )
            }
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
        // 동일 잡의 success 콜백과 race 가능 — handleSuccess 와 같은 lock 사용.
        val job = jobRepository.findByIdForUpdate(jobId) ?: return
        if (job.status == JobStatus.SUCCESS || job.status == JobStatus.FAILED) return

        job.status = JobStatus.FAILED
        val code = envelope.error?.code
        val msg = envelope.error?.message
        job.errorMessage = listOfNotNull(code, msg).joinToString(": ").ifBlank { "FINAL_ILLUSTRATION_FAILED" }.take(65_535)
        job.finishedAt = LocalDateTime.now()
        tryInvalidatePollingCache(jobId)

        log.warn("[FINAL_ILLUST:RES] failed — jobId={}, code={}, message={}",
            jobId, envelope.error?.code, envelope.error?.message)
    }

    /**
     * resultPayload 전체를 String→Any? 로 읽는다 — page 결과("1"="url1", ...) + WEBTOON 메타
     * ("_layoutPublished", "_layoutFailed", ...) 모두 포함. 파싱 실패 시 빈 맵.
     */
    @Suppress("UNCHECKED_CAST")
    private fun readFullPayload(job: StoryGenerationJob): MutableMap<String, Any?> {
        val raw = job.resultPayload ?: return mutableMapOf()
        return try {
            val parsed = objectMapper.readValue(raw, Map::class.java) as Map<*, *>
            parsed.entries
                .mapNotNull { (k, v) ->
                    val key = k?.toString() ?: return@mapNotNull null
                    key to v
                }
                .toMap()
                .toMutableMap()
        } catch (e: Exception) {
            log.warn("[FINAL_ILLUST:RES] cannot parse resultPayload JSON for job={}: {}", job.id, raw, e)
            mutableMapOf()
        }
    }

    /**
     * full payload 에서 page-numeric key 만 골라 (pageNumber → imageUrl) 맵으로 환원.
     * 메타 키("_layoutPublished" 등) 와 String 이 아닌 값은 자동 제외.
     */
    private fun pageEntriesOnly(full: Map<String, Any?>): MutableMap<Int, String> {
        val result = mutableMapOf<Int, String>()
        full.forEach { (k, v) ->
            val intKey = k.toIntOrNull() ?: return@forEach
            val strVal = (v as? String) ?: return@forEach
            result[intKey] = strVal
        }
        return result
    }

    private fun tryInvalidatePollingCache(jobId: Long) {
        afterCommit {
            try {
                jobStatusRedisRepo.invalidateJobResponse(jobId)
            } catch (e: Exception) {
                log.warn("Redis polling cache invalidate failed for FINAL_ILLUSTRATION job {} (non-fatal): {}", jobId, e.message)
            }
        }
    }

    /**
     * requestPayload (FinalIllustrationJobMeta) 의 payload.items.size 를 읽어 페이지 수 도출.
     * 파싱 실패 시 Int.MAX_VALUE 반환 → 절대 SUCCESS 로 안 빠지게 안전 가드 (실패 시 영구 RUNNING).
     */
    private fun expectedPageCount(job: StoryGenerationJob): Int {
        return try {
            val req = objectMapper.readTree(job.requestPayload)
            val payload = req.path("payload")
            when {
                payload.path("items").isArray -> payload.path("items").size()
                !payload.path("item").isMissingNode -> 1
                else -> Int.MAX_VALUE
            }
        } catch (e: Exception) {
            log.warn("[FINAL_ILLUST:RES] cannot parse expectedPageCount for jobId={}", job.id, e)
            Int.MAX_VALUE
        }
    }

    companion object {
        /** WEBTOON 좌표 batch publish 멱등 가드. resultPayload JSON 의 boolean 키. */
        const val META_LAYOUT_PUBLISHED = "_layoutPublished"
        /** 좌표 추출 실패 페이지 목록 (List<Int>). 사용자 수동 재시도 버튼 노출용. */
        const val META_LAYOUT_FAILED_PAGES = "_layoutFailed"
        /** 좌표 추출 완료 페이지 수 (Int). progress 표기용. */
        const val META_LAYOUT_DONE_COUNT = "_layoutDone"
    }

    private data class ReviseVersionMeta(val version: Int?, val prompt: String?)

    private fun readReviseVersionMeta(job: StoryGenerationJob): ReviseVersionMeta {
        return try {
            val payload = objectMapper.readTree(job.requestPayload).path("payload")
            ReviseVersionMeta(
                version = payload.path("item").path("outputVersion").asInt(0).takeIf { it > 0 },
                prompt = payload.path("userPrompt").asString(null),
            )
        } catch (e: Exception) {
            log.warn("[FINAL_ILLUST:RES] cannot parse revise version meta for jobId={}", job.id, e)
            ReviseVersionMeta(version = null, prompt = null)
        }
    }
}
