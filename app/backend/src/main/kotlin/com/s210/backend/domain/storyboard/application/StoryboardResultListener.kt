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
import com.s210.backend.domain.storyboard.application.dto.StoryboardPayload
import org.slf4j.LoggerFactory
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

    @RabbitListener(queues = [RabbitMQConfig.RESULT_QUEUE])
    @Transactional
    fun onResult(envelope: StoryResultEnvelope) {
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

    private fun handleSuccess(job: StoryGenerationJob, payload: StoryboardPayload) {
        // 1) 작업 이력 업데이트 — 비용/소요시간 집계용
        job.status = JobStatus.SUCCESS
        job.resultPayload = objectMapper.writeValueAsString(payload)
        job.costUsd = payload.usage.costUsd?.let { BigDecimal.valueOf(it) }
        job.finishedAt = LocalDateTime.now()

        // 2) 동화 메타 row 1건 생성
        //    - `prompt`: 자유 프롬프트 입력 없는 정책이라 빈 문자열.
        //    - `story`:  DB 컬럼이 VARCHAR(255) 라 synopsis 가 길 경우 truncate.
        //                (원본은 result_payload 및 Story.synopsis 에 보존.)
        val storyBoard = storyBoardRepository.save(
            StoryBoard(
                storyId = job.storyId,
                prompt = "",
                story = payload.synopsis.take(255),
                createAt = LocalDate.now(),
            ),
        )

        // 3) 페이지별 텍스트 저장. imageUrl 은 후속 일러스트 단계에서 채움.
        payload.pages.forEach { page ->
            storyboardPageRepository.save(
                StoryboardPage(
                    storyBoardId = storyBoard.id,
                    pageNumber = page.pageNumber,
                    englishText = page.englishText,
                    koreanText = page.koreanText,
                ),
            )
        }

        // 4) FE 가 바로 보여줄 수 있도록 Story 엔티티에도 요약 반영.
        storyRepository.findById(job.storyId).ifPresent { story ->
            story.title = payload.title
            story.synopsis = payload.synopsis
        }

        log.info(
            "Job {} SUCCESS — storyId={}, pages={}, costUsd={}",
            job.id, job.storyId, payload.pages.size, payload.usage.costUsd,
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
