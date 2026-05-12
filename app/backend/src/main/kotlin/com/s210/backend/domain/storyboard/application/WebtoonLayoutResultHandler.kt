package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.redis.JobStatusRedisRepository
import com.s210.backend.common.transaction.afterCommit
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneSentenceRepository
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
 * 좌표 영속화 (data model):
 *  - 페이지 단위로 [scene.character_anchors] JSON 배열에 `[{name, x, y, confidence}, ...]` 저장.
 *    1 캐릭터 = 1 anchor — 같은 페이지에서 같은 캐릭터의 여러 문장은 같은 anchor 를 공유.
 *  - sentence 레벨엔 좌표를 박지 않는다 (구 sentence.bubble_slot 컬럼은 V23 에서 DROP).
 *  - FE 가 sentence.speakerKey 로 scene.character_anchors[].name 을 lookup 해서 위치 결정.
 *    NARRATION (speakerKey 없음) → FE fallback (top center).
 *
 * 동작:
 *  - COMPLETED: AI 가 보낸 candidates 그대로 scene.character_anchors 에 저장. 페이지 단위로
 *               `_layoutDone` 카운트. 모든 페이지 도착 시 잡 → SUCCESS.
 *  - FAILED:    해당 페이지를 `_layoutFailed` 리스트에 추가. 잡 status 는 진행 중이면 그대로
 *               RUNNING 유지. 사용자가 추후 재시도 버튼으로 복구.
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

        // 1) scene 조회.
        val scene = sceneRepository.findByStoryIdAndPageNumber(job.storyId, pageNumber)
        if (scene == null) {
            log.warn("[LAYOUT:RES] scene not found storyId={} page={}", job.storyId, pageNumber)
            // 잡 자체는 계속 흘려보낸다 — 페이지를 done 으로 카운트해 잡 마감 흐름 유지.
            markPageDone(job, pageNumber, failed = true)
            return
        }

        // 2) AI 가 보낸 candidates → scene.character_anchors JSON 으로 직렬화 후 저장.
        //    형식: [{"name":"해솔","x":0.42,"y":0.31,"confidence":0.85}, ...].
        val candidates = envelope.payload?.characters.orEmpty()
        if (candidates.isEmpty()) {
            log.warn("[LAYOUT:RES] empty characters[] from AI — jobId={}, page={}", jobId, pageNumber)
        } else {
            log.info(
                "[LAYOUT:RES] anchors received — jobId={}, page={}, candidates={}",
                jobId, pageNumber,
                candidates.joinToString(prefix = "[", postfix = "]") { c ->
                    "${c.name}@(x=${"%.3f".format(c.anchor.x)},y=${"%.3f".format(c.anchor.y)},conf=${"%.2f".format(c.confidence)})"
                },
            )
        }

        val anchorRows = candidates.map { c ->
            CharacterAnchorRow(
                name = c.name,
                x = c.anchor.x,
                y = c.anchor.y,
                confidence = c.confidence,
            )
        }
        scene.characterAnchors = objectMapper.writeValueAsString(anchorRows)

        // 3) sentence-level speaker 매칭은 더 이상 영속화하지 않는다 — FE 가 sentence.speakerKey
        //    로 scene.character_anchors[].name 을 lookup. 다만 운영 디버깅을 위해
        //    "어느 speaker 가 매칭/미매칭됐는지" 로깅은 유지한다.
        val anchorByName = candidates.associateBy { it.name }
        val sentences = sceneSentenceRepository.findAllBySceneIdIn(listOf(scene.id))
            .sortedBy { it.sentenceOrder }
        sentences.forEach { sentence ->
            val source = when {
                sentence.speakerKey.isNullOrBlank() -> "NARRATION(FE fallback)"
                anchorByName.containsKey(sentence.speakerKey) -> "MATCH"
                else -> "MISS(speakerKey not in candidates)"
            }
            log.info(
                "[LAYOUT:RES]   sentence#{} speaker='{}' → {}",
                sentence.sentenceOrder, sentence.speakerKey, source,
            )
        }

        markPageDone(job, pageNumber, failed = false)
        log.info(
            "[LAYOUT:RES] page success — jobId={}, page={}, characters={}, sentences={}",
            jobId, pageNumber, candidates.size, sentences.size,
        )
    }

    /**
     * scene.character_anchors 컬럼의 JSON 배열 원소.
     *
     * FE [`CharacterAnchorView`] 와 1:1 — Jackson 이 같은 필드명으로 직/역직렬화 호환.
     */
    private data class CharacterAnchorRow(
        val name: String,
        val x: Double,
        val y: Double,
        val confidence: Double,
    )

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

    /**
     * 좌표 결과 envelope 의 trackingJobId 로 처리 가능한 잡 타입.
     *
     *  - FINAL_ILLUSTRATION   : Step 5 PATCH /style + Step 8 동화 단위 batch 재생성. 페이지 N장.
     *  - WEBTOON_LAYOUT_RETRY : 사용자 수동 좌표 재추출. 단건.
     *  - ILLUSTRATION         : Step 8 단일 페이지 재생성 (SceneIllustrationService.regenerateIllustration).
     *                           항상 single-page revise 라 결과 1개 → 즉시 SUCCESS 마감.
     */
    private fun isLayoutTrackingJob(job: StoryGenerationJob): Boolean =
        job.jobType == JobType.FINAL_ILLUSTRATION
            || job.jobType == JobType.WEBTOON_LAYOUT_RETRY
            || job.jobType == JobType.ILLUSTRATION

    /**
     * 페이지를 done 으로 카운트하고, 모든 페이지 도착 시 잡을 SUCCESS 로 마감.
     *
     * resultPayload 의 메타 키:
     *  - `_layoutDone` (Int)  : 좌표 처리 완료 페이지 수.
     *  - `_layoutFailed` (List<Int>) : 좌표 추출 실패 페이지 — 사용자 수동 재시도 후보.
     *
     * 마감 정책: failed 페이지가 섞여있어도 잡 status 는 SUCCESS — 사용자에게 동화는 보여주되
     * 부분 페이지만 재시도 가능하도록. 모두 실패하면 FE 가 scene.character_anchors 가 비어있는
     * 신호로 재시도 버튼을 모든 페이지에 노출.
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

        // 잡 마감 정책:
        //  - FINAL_ILLUSTRATION 잡(정상 batch): 모든 페이지 도착 시 SUCCESS — expectedLayoutPageCount 가
        //    requestPayload.payload.items[].pageNumber 카운트로 N 산출.
        //  - WEBTOON_LAYOUT_RETRY 잡: 단건 — 결과 1개 도착 시 즉시 마감 (failed 면 FAILED).
        //  - ILLUSTRATION 잡: Step 8 single-page revise. requestPayload 에 items[] 메타가 없어
        //    batch 분기로 가면 expectedLayoutPageCount 가 Int.MAX_VALUE 반환 → 영구 RUNNING.
        //    revise 는 항상 1장이라 retry 와 동일하게 단건 즉시 마감으로 처리.
        when (job.jobType) {
            JobType.FINAL_ILLUSTRATION -> {
                val expected = expectedLayoutPageCount(job)
                if (doneSet.size >= expected && job.status == JobStatus.RUNNING) {
                    job.status = JobStatus.SUCCESS
                    job.finishedAt = LocalDateTime.now()
                    afterCommit { tryInvalidatePollingCache(job.id) }
                }
            }
            JobType.WEBTOON_LAYOUT_RETRY, JobType.ILLUSTRATION -> {
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
