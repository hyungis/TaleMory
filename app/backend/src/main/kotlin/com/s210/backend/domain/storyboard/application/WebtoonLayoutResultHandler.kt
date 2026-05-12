package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.redis.JobStatusRedisRepository
import com.s210.backend.common.transaction.afterCommit
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.SceneSentence
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneSentenceRepository
import com.s210.backend.domain.story.model.AnchorPoint
import com.s210.backend.domain.storyboard.application.dto.CharacterAnchorCandidate
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationLayoutResultEnvelope
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.time.LocalDateTime

/**
 * WEBTOON 모드 좌표 추출 결과(ANALYZE_FINAL_ILLUSTRATION_LAYOUT_*) 처리기.
 *
 * 호출 시점:
 *  - StoryboardResultListener.onResult 가 type 으로 분기해 [handleSuccess]/[handleFailure] 호출.
 *  - listener 가 @Transactional 로 감싸서 persist + 잡 status 갱신이 같은 트랜잭션.
 *
 * jobId 매핑 (Option A — 단일 jobId):
 *  - 정상 흐름: jobId == FINAL_ILLUSTRATION 잡의 PK.
 *  - 사용자 수동 재시도: jobId == WEBTOON_LAYOUT_RETRY 잡의 PK (단일 페이지 결과 envelope).
 *
 * 동작:
 *  - COMPLETED: 페이지의 DIALOGUE 문장에 캐릭터 anchor 매핑 → bubble_slot JSON 저장.
 *               NARRATION 문장은 (0.5, 0.05) 고정 주입. 페이지 단위로 `_layoutDone` 카운트.
 *               모든 페이지 도착 시 잡 → SUCCESS (FAILED 페이지는 `_layoutFailed` 에 남기되 잡 자체는 SUCCESS).
 *  - FAILED:    해당 페이지를 `_layoutFailed` 리스트에 추가. 잡 status 는 진행 중이면 그대로 RUNNING 유지
 *               (다른 페이지가 끝날 때 SUCCESS 로 마감). 사용자가 추후 재시도 버튼으로 복구.
 */
@Component
class WebtoonLayoutResultHandler(
    private val jobRepository: StoryGenerationJobRepository,
    private val sceneRepository: SceneRepository,
    private val sceneSentenceRepository: SceneSentenceRepository,
    private val jobStatusRedisRepo: JobStatusRedisRepository,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun handleSuccess(envelope: FinalIllustrationLayoutResultEnvelope) {
        val jobId = envelope.jobId.toLongOrNull() ?: run {
            log.warn("[LAYOUT:RES] invalid jobId={}", envelope.jobId)
            return
        }
        val job = jobRepository.findByIdForUpdate(jobId) ?: run {
            log.warn("[LAYOUT:RES] job not found id={}", jobId)
            return
        }
        if (!isLayoutTrackingJob(job)) {
            log.warn("[LAYOUT:RES] unsupported job type={} for layout result jobId={}", job.jobType, jobId)
            return
        }
        val pageNumber = envelope.pageNumber ?: run {
            log.warn("[LAYOUT:RES] missing pageNumber in COMPLETED envelope jobId={}", jobId)
            return
        }

        // 1) 해당 페이지의 sentences 모두 로드 → DIALOGUE 는 anchor 매칭, NARRATION 은 (0.5, 0.05).
        val scene = sceneRepository.findByStoryIdAndPageNumber(job.storyId, pageNumber)
        if (scene == null) {
            log.warn("[LAYOUT:RES] scene not found storyId={} page={}", job.storyId, pageNumber)
            // 잡 자체는 계속 흘려보낸다 — 페이지를 done 으로 카운트해 잡 마감 흐름 유지.
            markPageDone(job, pageNumber, failed = true)
            return
        }
        val sentences = sceneSentenceRepository.findAllBySceneIdIn(listOf(scene.id))
            .sortedBy { it.sentenceOrder }

        val anchorByName = envelope.payload?.characters
            ?.associateBy { it.name }
            .orEmpty()

        sentences.forEach { sentence ->
            val anchor = computeAnchor(sentence, anchorByName)
            sentence.bubbleSlot = anchor?.let { objectMapper.writeValueAsString(it) }
        }

        markPageDone(job, pageNumber, failed = false)
        log.info(
            "[LAYOUT:RES] page success — jobId={}, page={}, sentences={}, characters={}",
            jobId, pageNumber, sentences.size, anchorByName.size,
        )
    }

    fun handleFailure(envelope: FinalIllustrationLayoutResultEnvelope) {
        val jobId = envelope.jobId.toLongOrNull() ?: run {
            log.warn("[LAYOUT:RES] invalid jobId={}", envelope.jobId)
            return
        }
        val job = jobRepository.findByIdForUpdate(jobId) ?: run {
            log.warn("[LAYOUT:RES] job not found id={}", jobId)
            return
        }
        if (!isLayoutTrackingJob(job)) {
            log.warn("[LAYOUT:RES] unsupported job type={} for layout failure jobId={}", job.jobType, jobId)
            return
        }
        val pageNumber = envelope.pageNumber ?: run {
            log.warn("[LAYOUT:RES] FAILED envelope without pageNumber jobId={}", jobId)
            return
        }
        markPageDone(job, pageNumber, failed = true)
        log.warn(
            "[LAYOUT:RES] page failed — jobId={}, page={}, code={}, message={}",
            jobId, pageNumber, envelope.error?.code, envelope.error?.message,
        )
    }

    // ------------------------------------------------------------------

    private fun isLayoutTrackingJob(job: StoryGenerationJob): Boolean =
        job.jobType == JobType.FINAL_ILLUSTRATION || job.jobType == JobType.WEBTOON_LAYOUT_RETRY

    /**
     * sentence 별 anchor 결정:
     *  - speakerKey 가 비었으면(NARRATION) → (0.5, 0.05) 고정.
     *  - speakerKey 가 있으면 anchorByName[speakerKey] → AnchorPoint. 매칭 실패 시 null
     *    (FE 가 fallback 위치 렌더 + 재시도 노출).
     */
    private fun computeAnchor(
        sentence: SceneSentence,
        anchorByName: Map<String, CharacterAnchorCandidate>,
    ): AnchorPoint? {
        val speakerKey = sentence.speakerKey?.takeIf(String::isNotBlank)
            ?: return AnchorPoint.NARRATION_DEFAULT
        val candidate = anchorByName[speakerKey] ?: return null
        return runCatching {
            AnchorPoint(x = candidate.anchor.x, y = candidate.anchor.y)
        }.getOrNull()
    }

    /**
     * 페이지를 done 으로 카운트하고, 모든 페이지 도착 시 잡을 SUCCESS 로 마감.
     *
     * resultPayload 의 메타 키:
     *  - `_layoutDone` (Int)  : 좌표 처리 완료 페이지 수.
     *  - `_layoutFailed` (List<Int>) : 좌표 추출 실패 페이지 — 사용자 수동 재시도 후보.
     *
     * 마감 정책: failed 페이지가 섞여있어도 잡 status 는 SUCCESS — 사용자에게 동화는 보여주되
     * 부분 페이지만 재시도 가능하도록. 모두 실패하면 FE 가 SUCCESS+sentence.bubbleSlot=NULL 신호로
     * 재시도 버튼을 모든 페이지에 노출.
     */
    @Suppress("UNCHECKED_CAST")
    private fun markPageDone(job: StoryGenerationJob, pageNumber: Int, failed: Boolean) {
        val payload = readFullPayload(job).toMutableMap()

        val doneSet = (payload[META_LAYOUT_DONE_PAGES] as? List<*>)
            ?.mapNotNull { (it as? Number)?.toInt() }
            ?.toMutableSet()
            ?: mutableSetOf()
        doneSet.add(pageNumber)
        payload[META_LAYOUT_DONE_PAGES] = doneSet.sorted()

        val failedSet = (payload[META_LAYOUT_FAILED_PAGES] as? List<*>)
            ?.mapNotNull { (it as? Number)?.toInt() }
            ?.toMutableSet()
            ?: mutableSetOf()
        if (failed) failedSet.add(pageNumber) else failedSet.remove(pageNumber)
        payload[META_LAYOUT_FAILED_PAGES] = failedSet.sorted()

        // FINAL_ILLUSTRATION 잡(정상 batch) 만 모든 페이지 도착 시 SUCCESS 마감.
        // WEBTOON_LAYOUT_RETRY 잡은 단건 처리 → 결과 1개 도착 시 즉시 마감.
        when (job.jobType) {
            JobType.FINAL_ILLUSTRATION -> {
                val expected = expectedLayoutPageCount(job)
                if (doneSet.size >= expected && job.status == JobStatus.RUNNING) {
                    job.status = JobStatus.SUCCESS
                    job.finishedAt = LocalDateTime.now()
                    afterCommit { tryInvalidatePollingCache(job.id) }
                }
            }
            JobType.WEBTOON_LAYOUT_RETRY -> {
                if (job.status == JobStatus.RUNNING) {
                    job.status = if (failed) JobStatus.FAILED else JobStatus.SUCCESS
                    job.finishedAt = LocalDateTime.now()
                    afterCommit { tryInvalidatePollingCache(job.id) }
                }
            }
            else -> Unit
        }

        job.resultPayload = objectMapper.writeValueAsString(payload)
    }

    @Suppress("UNCHECKED_CAST")
    private fun readFullPayload(job: StoryGenerationJob): Map<String, Any?> {
        val raw = job.resultPayload ?: return emptyMap()
        return try {
            (objectMapper.readValue(raw, Map::class.java) as Map<*, *>)
                .entries
                .mapNotNull { (k, v) -> (k?.toString() ?: return@mapNotNull null) to v }
                .toMap()
        } catch (e: Exception) {
            log.warn("[LAYOUT:RES] cannot parse resultPayload jobId={}: {}", job.id, raw, e)
            emptyMap()
        }
    }

    /**
     * 좌표 추출 대상 페이지 수 = WebtoonLayoutPublisher 가 publish 한 페이지 수.
     *  - 배치 generate: requestPayload.payload.items 배열에서 pageNumber > 0 인 항목 수.
     *    publisher 가 page 0 (표지) 를 제외하므로 expected = pageNumber > 0 의 갯수.
     *  - revise (단일 페이지 재생성): requestPayload.payload.item (단수) 가 존재 → 1.
     *
     * 안전 가드: 파싱 실패 시 Int.MAX_VALUE 로 영구 RUNNING — race 로 잘못 SUCCESS 마감 차단.
     */
    private fun expectedLayoutPageCount(job: StoryGenerationJob): Int {
        return try {
            val req = objectMapper.readTree(job.requestPayload)
            val payload = req.path("payload")
            val items = payload.path("items")
            if (items.isArray) {
                var count = 0
                for (it in items) {
                    if (it.path("pageNumber").asInt(0) > 0) count++
                }
                if (count == 0) Int.MAX_VALUE else count
            } else if (!payload.path("item").isMissingNode) {
                1
            } else {
                Int.MAX_VALUE
            }
        } catch (e: Exception) {
            log.warn("[LAYOUT:RES] cannot derive expected page count jobId={}", job.id, e)
            Int.MAX_VALUE
        }
    }

    private fun tryInvalidatePollingCache(jobId: Long) {
        try {
            jobStatusRedisRepo.invalidateJobResponse(jobId)
        } catch (e: Exception) {
            log.warn("Redis polling cache invalidate failed for layout job {} (non-fatal): {}", jobId, e.message)
        }
    }

    companion object {
        const val META_LAYOUT_DONE_PAGES = "_layoutDonePages"
        const val META_LAYOUT_FAILED_PAGES = "_layoutFailed"
    }
}
