package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.story.entity.StoryBoard
import com.s210.backend.domain.story.entity.StoryboardPage
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.storyboard.application.dto.StoryResultEnvelope
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageResultEnvelope
import com.s210.backend.domain.storyboard.application.dto.StoryboardPayload
import org.slf4j.LoggerFactory
import org.springframework.amqp.core.Message
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * AI 워커가 `ai.result` exchange 로 publish 한 스토리 생성 결과를 수신한다.
 *
 * 처리 흐름:
 *  1. envelope.jobId (= external_id) 로 Job 조회 — 없으면 warn 로그 후 skip.
 *  2. 멱등성: 이미 SUCCESS/FAILED 상태면 재처리하지 않음 (중복 delivery 대비).
 *  3. status 분기:
 *      - COMPLETED → Job UPDATE + StoryBoard INSERT + StoryboardPage INSERT N개 +
 *        Story.title/synopsis 반영
 *      - FAILED    → Job UPDATE (errorMessage 기록)
 *
 * 트랜잭션 경계:
 *  Listener 메서드 전체를 @Transactional 로 감싸 Job 업데이트 / StoryBoard / StoryboardPage INSERT 를
 *  원자성 보장. 중간 예외 발생 시 DB rollback + RabbitMQ nack → 재시도 (멱등성으로 커버).
 */
@Component
class StoryboardResultListener(
    private val jobRepository: StoryGenerationJobRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val storyboardPageRepository: StoryboardPageRepository,
    private val storyRepository: StoryRepository,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * 통합 결과 큐 진입점. STORY / STORYBOARD_IMAGE envelope 가 같은 큐로 들어오므로
     * raw Message body 의 `type` 필드를 보고 분기한다.
     *
     * 분기 방식:
     *  - "STORYBOARD_IMAGE" 가 포함된 type → 이미지 결과
     *  - "STORY" 가 포함된 type           → 줄거리(STORY) 결과
     *  - 그 외                             → warn 로그 후 무시
     *
     * Jackson `treeToValue` 로 각 타입에 맞춰 deserialize 하므로,
     * STORY 메시지가 IMAGE envelope 으로 잘못 매핑되거나 vice versa 하는 일은 없다.
     */
    @RabbitListener(queues = [RabbitMQConfig.RESULT_QUEUE])
    @Transactional
    fun onResult(message: Message) {
        val body = String(message.body, Charsets.UTF_8)
        val tree = try {
            objectMapper.readTree(body)
        } catch (e: Exception) {
            log.warn("Cannot parse AI result envelope JSON: {}", body, e)
            return
        }
        val type = tree.get("type")?.asString().orEmpty()

        when {
            type.contains("STORYBOARD_IMAGE") -> {
                val envelope = objectMapper.treeToValue(tree, StoryboardImageResultEnvelope::class.java)
                handleImageResult(envelope)
            }
            type.contains("STORY") -> {
                val envelope = objectMapper.treeToValue(tree, StoryResultEnvelope::class.java)
                handleStoryResult(envelope)
            }
            else -> log.warn("Unknown envelope type='{}', body={}", type, body)
        }
    }

    private fun handleStoryResult(envelope: StoryResultEnvelope) {
        // envelope.jobId 는 AI 스펙상 string. DB PK (Long) 로 파싱 실패하면 잘못된 메시지.
        val jobIdLong = envelope.jobId.toLongOrNull()
        if (jobIdLong == null) {
            log.warn("Invalid jobId format from AI: {} (not a Long)", envelope.jobId)
            return
        }

        val job = jobRepository.findById(jobIdLong).orElse(null)
        if (job == null) {
            // 우리가 발행한 적 없는 jobId — 시스템 재배포 or 다른 환경 오배달 가능성.
            log.warn("Unknown jobId from AI: {} (status={})", envelope.jobId, envelope.status)
            return
        }

        if (job.status == JobStatus.SUCCESS || job.status == JobStatus.FAILED) {
            // 재전송된 메시지 — 이미 처리했으므로 skip. ack 는 정상 처리.
            log.info("Job {} already finalized ({}), skip duplicate", job.id, job.status)
            return
        }

        when (envelope.status.uppercase()) {
            "COMPLETED" -> {
                val payload = envelope.payload
                if (payload == null) {
                    log.warn("COMPLETED envelope has no payload for jobId {}", envelope.jobId)
                    markFailed(job, "PAYLOAD_MISSING", "AI 응답에 payload 가 없습니다.")
                    return
                }
                handleSuccess(job, payload)
            }
            "FAILED" -> {
                val code = envelope.error?.code ?: "UNKNOWN"
                val message = envelope.error?.message ?: "에러 정보 없음"
                markFailed(job, code, message)
            }
            else -> {
                log.warn("Unknown envelope status '{}' for jobId {}", envelope.status, envelope.jobId)
            }
        }
    }

    /**
     * 이미지 결과 한 건 처리.
     *
     * 정책:
     *  - 페이지의 `image_url` 은 일단 항상 갱신 (FAILED 가 아니라 COMPLETED 인 경우).
     *  - 잡 마무리:
     *      - REGENERATE_* type → 1장 도달 즉시 SUCCESS
     *      - GENERATE_*    type → 모든 페이지의 image_url 이 채워졌을 때만 SUCCESS
     *  - 1장이라도 FAILED 면 잡 즉시 FAILED. 이미 채운 다른 페이지의 image_url 은 보존
     *    (유저가 실패한 페이지만 재생성으로 보완할 수 있도록).
     */
    private fun handleImageResult(envelope: StoryboardImageResultEnvelope) {
        val jobIdLong = envelope.jobId.toLongOrNull()
        if (jobIdLong == null) {
            log.warn("Invalid jobId format from AI image result: {}", envelope.jobId)
            return
        }

        val job = jobRepository.findById(jobIdLong).orElse(null)
        if (job == null) {
            log.warn("Unknown image jobId from AI: {} (status={})", envelope.jobId, envelope.status)
            return
        }

        if (job.status == JobStatus.SUCCESS || job.status == JobStatus.FAILED) {
            // 잡이 이미 끝난 경우라도 도착한 COMPLETED 페이지는 storyboard_pages 에 반영해두면
            // 유저 입장에선 "그 페이지는 이미지가 있다" 라는 데이터 자체는 살아남음.
            // 단 잡 status 는 더 변경하지 않는다.
            if (envelope.status.equals("COMPLETED", ignoreCase = true)) {
                applyImageUrlIfPresent(envelope)
            }
            log.info(
                "Image job {} already finalized ({}), skip job-level update",
                job.id, job.status,
            )
            return
        }

        when (envelope.status.uppercase()) {
            "COMPLETED" -> handleImageSuccess(job, envelope)
            "FAILED" -> {
                val code = envelope.error?.code ?: "UNKNOWN"
                val message = envelope.error?.message ?: "에러 정보 없음"
                markFailed(job, code, message)
            }
            else -> log.warn(
                "Unknown image envelope status '{}' for jobId {}",
                envelope.status, envelope.jobId,
            )
        }
    }

    private fun handleImageSuccess(job: StoryGenerationJob, envelope: StoryboardImageResultEnvelope) {
        val payload = envelope.payload
        val resultData = payload?.result
        if (resultData == null) {
            log.warn("Image COMPLETED envelope missing payload.result jobId={}", envelope.jobId)
            markFailed(job, "PAYLOAD_MISSING", "이미지 결과 payload 가 없습니다.")
            return
        }

        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(envelope.storyId)
        if (storyBoard == null) {
            log.warn("StoryBoard not found for storyId={} (image job={})", envelope.storyId, envelope.jobId)
            markFailed(job, "STORY_BOARD_NOT_FOUND", "스토리보드 row 가 없습니다.")
            return
        }

        val page = storyboardPageRepository.findByStoryBoardIdAndPageNumber(storyBoard.id, resultData.pageNumber)
        if (page == null) {
            log.warn(
                "StoryboardPage not found storyBoardId={}, pageNumber={} (image job={})",
                storyBoard.id, resultData.pageNumber, envelope.jobId,
            )
            markFailed(job, "PAGE_NOT_FOUND", "해당 페이지 row 가 없습니다.")
            return
        }

        page.imageUrl = resultData.imageUrl
        // dirty checking 으로 트랜잭션 종료 시 자동 UPDATE.

        val isRegenerate = envelope.type.startsWith("REGENERATE_")
        if (isRegenerate) {
            // 단일 페이지 재생성 — 1장 도달 = 즉시 마무리.
            finalizeImageJobSuccess(job, payload.seed, totalPagesDone = 1)
            return
        }

        // 배치 GENERATE — 같은 storyBoard 의 모든 페이지가 image_url 을 가졌는지 확인.
        val pages = storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)
        val allFilled = pages.isNotEmpty() && pages.all { !it.imageUrl.isNullOrBlank() }
        if (allFilled) {
            finalizeImageJobSuccess(job, payload.seed, totalPagesDone = pages.size)
        } else {
            log.info(
                "Image job {} progressing — page {} done ({}/{})",
                job.id, resultData.pageNumber,
                pages.count { !it.imageUrl.isNullOrBlank() }, pages.size,
            )
        }
    }

    /**
     * 잡 status 에 영향 주지 않고 storyboard_pages.image_url 만 best-effort 로 update.
     * 이미 SUCCESS/FAILED 된 잡에 뒤늦게 도착한 결과 메시지 처리용.
     */
    private fun applyImageUrlIfPresent(envelope: StoryboardImageResultEnvelope) {
        val resultData = envelope.payload?.result ?: return
        val storyBoard = storyBoardRepository
            .findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(envelope.storyId) ?: return
        val page = storyboardPageRepository
            .findByStoryBoardIdAndPageNumber(storyBoard.id, resultData.pageNumber) ?: return
        page.imageUrl = resultData.imageUrl
    }

    private fun finalizeImageJobSuccess(job: StoryGenerationJob, seed: Int, totalPagesDone: Int) {
        job.status = JobStatus.SUCCESS
        job.finishedAt = LocalDateTime.now()
        // costUsd: 페이지별 usage 가 따로 와서 합산해야 정확. PR 통합 단계에선 누적 X
        // (필요 시 후속 이슈에서 누적 로직 추가).
        log.info(
            "Image job {} SUCCESS — storyId={}, seed={}, pagesDone={}",
            job.id, job.storyId, seed, totalPagesDone,
        )
    }

    private fun handleSuccess(job: StoryGenerationJob, payload: StoryboardPayload) {
        // 이번 MR 스코프: "한글 동화 본문 (줄거리)" 만 유저에게 노출/저장한다.
        // AI 의 synopsis 는 영문 요약이라 유저 표시용으로 부적합.
        // 대신 pages[].koreanText 를 이어붙인 한글 전체 본문을 보여준다.
        //
        // pages / sentences / imagePrompt 같은 세부 메타는 그대로 job.resultPayload 에 보존 —
        // 후속 MR (스토리보드 확정 + 일러스트 생성) 에서 다시 활용.

        // 1) 작업 이력 업데이트 — 비용/소요시간 집계용
        job.status = JobStatus.SUCCESS
        job.resultPayload = objectMapper.writeValueAsString(payload)
        job.costUsd = payload.usage.costUsd?.let { BigDecimal.valueOf(it) }
        job.finishedAt = LocalDateTime.now()

        // 2) pages[].koreanText 를 단락 구분(\n\n) 으로 이어붙여 한글 동화 본문 생성.
        val koreanBody = payload.pages
            .sortedBy { it.pageNumber }
            .joinToString(separator = "\n\n") { it.koreanText.trim() }
            .ifBlank { payload.synopsis }   // 극단적으로 pages 비었을 때 fallback.

        // 3) 동화 메타 row — upsert: 같은 storyId 의 story_board 가 있으면 내용만 교체.
        //    (재생성해도 row 가 새로 생기지 않도록. story_generation_jobs 는 이력용으로 쌓임.)
        //    이후 storyboard_pages 갈아끼우기에 storyBoard.id 를 사용해야 하므로 한 변수로 묶어둔다.
        val storyBoard = run {
            val existing = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(job.storyId)
            if (existing != null) {
                existing.story = koreanBody
                existing.updateAt = LocalDate.now()
                existing
            } else {
                storyBoardRepository.save(
                    StoryBoard(
                        storyId = job.storyId,
                        prompt = "",
                        story = koreanBody,
                        createAt = LocalDate.now(),
                    ),
                )
            }
        }

        // 4) 페이지 단위 진실 테이블(storyboard_pages) 갈아끼우기.
        //    - 줄거리 재생성 시 페이지 수가 바뀔 수 있으므로 delete-then-insert.
        //    - sceneSummary / imagePrompt 까지 함께 보존해야 이후 이미지 생성 단계에서
        //      storyboard_pages 단일 소스로 페이로드를 조립할 수 있다 (옵션 D').
        //    - bulk DELETE (flushAutomatically=true) 로 UK(storyBoardId, pageNumber) 충돌 회피.
        storyboardPageRepository.deleteAllByStoryBoardId(storyBoard.id)
        storyboardPageRepository.saveAll(
            payload.pages.map { p ->
                StoryboardPage(
                    storyBoardId = storyBoard.id,
                    pageNumber = p.pageNumber,
                    englishText = p.englishText,
                    koreanText = p.koreanText,
                    sceneSummary = p.sceneSummary,
                    imagePrompt = p.imagePrompt,
                    imageUrl = null,
                )
            },
        )

        // 5) FE Step 3 가 즉시 보여줄 수 있도록 Story 엔티티에도 한글 본문 반영.
        storyRepository.findById(job.storyId).ifPresent { story ->
            story.title = payload.title
            story.synopsis = koreanBody
        }

        log.info(
            "Job {} SUCCESS — storyId={}, storyLen={}, pages={}, costUsd={}",
            job.id, job.storyId, koreanBody.length, payload.pages.size, payload.usage.costUsd,
        )
    }

    private fun markFailed(job: StoryGenerationJob, code: String, message: String) {
        job.status = JobStatus.FAILED
        // TEXT 컬럼이지만 극단적으로 긴 에러 방어 차원에서 64KB 로 상한.
        job.errorMessage = "$code: $message".take(65_535)
        job.finishedAt = LocalDateTime.now()
        log.warn("Job {} FAILED — {}: {}", job.id, code, message)
    }
}
