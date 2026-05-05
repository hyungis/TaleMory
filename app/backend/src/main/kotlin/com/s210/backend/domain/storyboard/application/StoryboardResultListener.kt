package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.redis.IllustrationVersionRedisRepository
import com.s210.backend.common.redis.StoryboardPageImageVersionRedisRepository
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.story.entity.StoryBoard
import com.s210.backend.domain.story.entity.StoryboardPage
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationResultEnvelope
import com.s210.backend.domain.storyboard.application.dto.StoryResultEnvelope
import com.s210.backend.domain.storyboard.application.dto.StorySummaryPayload
import com.s210.backend.domain.storyboard.application.dto.StorySummaryResultEnvelope
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageRegeneratePayload
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageResultEnvelope
import com.s210.backend.domain.storyboard.application.dto.StoryboardPayload
import com.s210.backend.domain.tts.application.TtsResultHandler
import com.s210.backend.domain.tts.application.dto.PreviewTtsResultEnvelope
import com.s210.backend.domain.tts.application.dto.StoryTtsResultEnvelope
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
    private val ttsResultHandler: TtsResultHandler,
    private val sceneRepository: SceneRepository,
    private val illustrationVersionRedisRepository: IllustrationVersionRedisRepository,
    private val storyboardPageImageVersionRepository: StoryboardPageImageVersionRedisRepository,
    private val finalIllustrationResultHandler: FinalIllustrationResultHandler,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        /**
         * 자료구조 차원에서 dispatch 함정 영구 차단 (Principle 4).
         * - `contains` / `firstOrNull` / 순서 의존 0개.
         * - AI 측 합의 type 만 정확히 enumerate. 미지의 type 은 WARN + silent drop.
         * - 단위 테스트에서 직접 검증 가능하도록 internal 노출.
         */
        internal object EnvelopeTypes {
            val STORY_SUMMARY = setOf(
                "GENERATE_STORY_SUMMARY_COMPLETED", "GENERATE_STORY_SUMMARY_FAILED",
                "REGENERATE_STORY_SUMMARY_COMPLETED", "REGENERATE_STORY_SUMMARY_FAILED",
            )
            val STORYBOARD_IMAGE = setOf(
                "GENERATE_STORYBOARD_IMAGE_COMPLETED", "GENERATE_STORYBOARD_IMAGE_FAILED",
                "REGENERATE_STORYBOARD_IMAGE_COMPLETED", "REGENERATE_STORYBOARD_IMAGE_FAILED",
            )
            val STORY = setOf("GENERATE_STORY_COMPLETED", "GENERATE_STORY_FAILED")
            val TTS = setOf("GENERATE_TTS_COMPLETED", "GENERATE_TTS_FAILED")
            val TTS_PREVIEW = setOf("GENERATE_TTS_PREVIEW_COMPLETED", "GENERATE_TTS_PREVIEW_FAILED")
            val FINAL_ILLUSTRATION = setOf(
                "GENERATE_FINAL_ILLUSTRATION_COMPLETED", "GENERATE_FINAL_ILLUSTRATION_FAILED",
            )
        }
    }

    /**
     * 통합 결과 큐 진입점. STORY_SUMMARY / STORY / STORYBOARD_IMAGE envelope 가 같은 큐로 들어오므로
     * raw Message body 의 `type` 필드를 Set exact-match 로 분기한다.
     *
     * ack 정책:
     *  @Transactional commit → Spring AMQP 가 ack 자동. markFailed 도 commit → ack.
     *  DB 가 진실원이므로 메시지 재전달 불요. 예외 발생 시 트랜잭션 롤백 → nack with requeue.
     *
     * 미지의 type 은 WARN 로깅 후 트랜잭션 commit → ack (silent drop).
     * AI schema 변경에 따른 unknown type alerting 은 별도 lane (Follow-up).
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

        when (type) {
            in EnvelopeTypes.STORY_SUMMARY -> {
                val envelope = objectMapper.treeToValue(tree, StorySummaryResultEnvelope::class.java)
                log.info(
                    "[SUMMARY:RES] received — type={}, jobId={}, status={}",
                    type, envelope.jobId, envelope.status,
                )
                handleStorySummaryResult(envelope)
            }
            in EnvelopeTypes.STORYBOARD_IMAGE -> {
                val envelope = objectMapper.treeToValue(tree, StoryboardImageResultEnvelope::class.java)
                handleImageResult(envelope)
            }
            in EnvelopeTypes.STORY -> {
                val envelope = objectMapper.treeToValue(tree, StoryResultEnvelope::class.java)
                log.info(
                    "[STORY:RES] received — type={}, jobId={}, storyId={}, status={}",
                    type, envelope.jobId, envelope.storyId, envelope.status,
                )
                handleStoryResult(envelope)
            }
            in EnvelopeTypes.TTS -> {
                val envelope = objectMapper.treeToValue(tree, StoryTtsResultEnvelope::class.java)
                log.info(
                    "[TTS:RES] received — type={}, jobId={}, storyId={}, status={}",
                    type, envelope.jobId, envelope.storyId, envelope.status,
                )
                ttsResultHandler.handle(envelope)
            }
            in EnvelopeTypes.TTS_PREVIEW -> {
                val envelope = objectMapper.treeToValue(tree, PreviewTtsResultEnvelope::class.java)
                log.info(
                    "[TTS_PREVIEW:RES] received ??type={}, jobId={}, status={}",
                    type, envelope.jobId, envelope.status,
                )
                ttsResultHandler.handle(envelope)
            }
            in EnvelopeTypes.FINAL_ILLUSTRATION -> {
                val envelope = objectMapper.treeToValue(tree, FinalIllustrationResultEnvelope::class.java)
                log.info(
                    "[FINAL_ILLUST:RES] received — type={}, jobId={}, page={}, status={}",
                    type, envelope.jobId, envelope.pageNumber, envelope.status,
                )
                when (envelope.status.uppercase()) {
                    "COMPLETED" -> finalIllustrationResultHandler.handleSuccess(envelope)
                    "FAILED" -> finalIllustrationResultHandler.handleFailure(envelope)
                    else -> log.warn("[FINAL_ILLUST:RES] unknown status='{}' jobId={}", envelope.status, envelope.jobId)
                }
            }
            else -> log.warn("Unknown envelope type='{}', body={}", type, body)
        }
    }

    /**
     * 줄거리(요약) 결과 한 건 처리 (GENERATE/REGENERATE × COMPLETED/FAILED 4종 동일 처리).
     *
     * COMPLETED:
     *  - Job UPDATE (status=SUCCESS, resultPayload, costUsd, finishedAt)
     *  - story_boards upsert: 같은 storyId 기존 row 가 있으면 `story=summaryKo` 로 갱신,
     *    없으면 신규 INSERT. 본문 잡 SUCCESS 가 그 사이 도착해서 `story` 컬럼이 본문 한글로 갱신됐더라도
     *    줄거리 SUCCESS 수신 시 다시 줄거리로 덮어씀 (의도된 동작, plan §1.3 D6-A).
     * FAILED:
     *  - Job UPDATE (status=FAILED, errorMessage). resultPayload 는 직전 SUCCESS 보존을 위해 갱신 안 함.
     */
    private fun handleStorySummaryResult(envelope: StorySummaryResultEnvelope) {
        val jobIdLong = envelope.jobId.toLongOrNull()
        if (jobIdLong == null) {
            log.warn("Invalid jobId format from AI summary result: {} (not a Long)", envelope.jobId)
            return
        }

        val job = jobRepository.findById(jobIdLong).orElse(null)
        if (job == null) {
            log.warn("Unknown summary jobId from AI: {} (status={})", envelope.jobId, envelope.status)
            return
        }

        if (job.status == JobStatus.SUCCESS || job.status == JobStatus.FAILED) {
            log.info("Summary job {} already finalized ({}), skip duplicate", job.id, job.status)
            return
        }

        when (envelope.status.uppercase()) {
            "COMPLETED" -> {
                val payload = envelope.payload
                if (payload == null) {
                    log.warn("Summary COMPLETED envelope has no payload for jobId {}", envelope.jobId)
                    markFailed(job, "PAYLOAD_MISSING", "AI 응답에 payload 가 없습니다.")
                    return
                }
                handleSummarySuccess(job, payload)
            }
            "FAILED" -> {
                val code = envelope.error?.code ?: "UNKNOWN"
                val message = envelope.error?.message ?: envelope.error?.code ?: "(unknown)"
                markFailed(job, code, message)
            }
            else -> {
                log.warn("Unknown summary envelope status '{}' for jobId {}", envelope.status, envelope.jobId)
            }
        }
    }

    private fun handleSummarySuccess(job: StoryGenerationJob, payload: StorySummaryPayload) {
        // 1) Job 이력 업데이트
        job.status = JobStatus.SUCCESS
        job.resultPayload = objectMapper.writeValueAsString(payload)
        job.costUsd = payload.usage.costUsd?.let { BigDecimal.valueOf(it) }
        job.finishedAt = LocalDateTime.now()

        // 2) story_boards upsert — V6 마이그레이션으로 story 컬럼이 TEXT 라 길이 제한 없음.
        //    historic upsert pattern 유지 (재생성 시 row 새로 안 만들고 동일 row 만 갱신).
        //    stories.synopsis 와 본질적으로 같은 한글 줄거리를 들고 있는 backup 사본.
        val existing = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(job.storyId)
        if (existing != null) {
            existing.story = payload.summaryKo
            existing.updateAt = LocalDate.now()
        } else {
            storyBoardRepository.save(
                StoryBoard(
                    storyId = job.storyId,
                    prompt = "",
                    story = payload.summaryKo,
                    createAt = LocalDate.now(),
                ),
            )
        }

        // 3) Story.synopsis (한글 줄거리) + Story.title (영문 제목) 저장 — Step 3 SUMMARY 잡이 둘의 SOT.
        //    한글 줄거리(synopsis):
        //     - 사용자가 Step 3 에서 편집하면 PATCH 로 이 컬럼 갱신.
        //     - StoryboardGenerationService.generate 가 본문 발행 시 이 컬럼을 우선 읽음.
        //     - STORY 잡 SUCCESS 가 더 이상 이 컬럼을 덮어쓰지 않음 (handleSuccess 참고).
        //    영문 제목(title):
        //     - AI 가 strict JSON 으로 매번 반환. 재생성 시 사용자가 명시적으로 제목 변경을 요청
        //       하지 않으면 LLM 이 previous title 그대로 보존하도록 prompt 가 구성됨.
        //     - 사용자가 직접 입력하는 UI 없음 — AI 결과를 그대로 SOT 로 사용.
        //     - 책장/뷰어/공유 메타에서 노출. null 이면 FE 가 한글 fallback ("OO이의 새 동화") 처리.
        storyRepository.findById(job.storyId).ifPresent { story ->
            story.synopsis = payload.summaryKo
            story.title = payload.title
        }

        log.info(
            "Summary job {} SUCCESS — storyId={}, summaryKoLen={}, costUsd={}",
            job.id, job.storyId, payload.summaryKo.length, payload.usage.costUsd,
        )
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
            if (job.sceneId == null && envelope.status.equals("COMPLETED", ignoreCase = true)) {
                applyImageUrlIfPresent(envelope)
            }
            log.info(
                "Image job {} already finalized ({}), skip job-level update",
                job.id, job.status,
            )
            return
        }

        // scene illustration regeneration (post-confirm)
        if (job.sceneId != null) {
            when (envelope.status.uppercase()) {
                "COMPLETED" -> handleSceneImageSuccess(job, envelope)
                "FAILED" -> {
                    val code = envelope.error?.code ?: "UNKNOWN"
                    val message = envelope.error?.message ?: "에러 정보 없음"
                    markFailed(job, code, message)
                }
                else -> log.warn(
                    "Unknown scene image envelope status '{}' for jobId {}",
                    envelope.status, envelope.jobId,
                )
            }
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

        // 재생성 분기에서 v1 lazy push 에 사용할 직전 URL 을 갱신 전에 캡처.
        // (한 번도 재생성 안 한 페이지의 imageUrl = 배치 생성본 v1 의 deterministic URL)
        val previousImageUrl = page.imageUrl

        page.imageUrl = resultData.imageUrl
        // dirty checking 으로 트랜잭션 종료 시 자동 UPDATE.

        val isRegenerate = envelope.type.startsWith("REGENERATE_")
        if (isRegenerate) {
            // 페이지 versioning push (Step 4 — Redis 설계 v4 §1.5).
            // best-effort: Redis 장애 시 page.imageUrl 갱신은 살아있고 잡 SUCCESS 흐름은 유지.
            runCatching {
                pushPageVersionForRegenerate(job, page.id, previousImageUrl, resultData.imageUrl)
            }.onFailure { e ->
                log.warn("Redis storyboard-image version push failed jobId={}: {}", job.id, e.message)
            }

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
     * Step 4 페이지 이미지 재생성 SUCCESS 처리 시 Redis 버전관리 push.
     *
     * 동작:
     *  1) job.requestPayload (StoryboardImageRegeneratePayload JSON) 에서
     *     - userPrompt
     *     - item.outputVersion (BE 가 publish 시점에 채운 값)
     *     를 안전하게 추출.
     *  2) 첫 재생성 (current 가 없음) 이면 v1 lazy push — 직전 page.imageUrl 을 v1 으로 보존.
     *  3) 새 outputVersion 으로 push (versions 리스트 LPUSH + LTRIM 10 + current 갱신).
     *
     * 실패 시:
     *  - extractRegeneratePayload 가 null 을 반환하면 push 스킵 + warn 로그 (외부에서 catch).
     *  - Redis 자체 실패는 호출자(handleImageSuccess) 의 runCatching 에서 흡수.
     *
     * 주의:
     *  - newImageUrl = AI 워커가 versioned key (`stories/.../v{N}.png`) 로 저장한 결과 URL.
     *  - previousImageUrl 이 null 인 케이스 (배치 v1 이 아직 안 채워졌는데 재생성이 들어옴) 는
     *    데이터 정합성 깨짐 — 그래도 새 버전만 push 해 흐름 유지 (잡 SUCCESS 보존).
     */
    private fun pushPageVersionForRegenerate(
        job: StoryGenerationJob,
        pageId: Long,
        previousImageUrl: String?,
        newImageUrl: String,
    ) {
        val req = extractRegeneratePayload(job) ?: run {
            log.warn(
                "Skipping version push — failed to parse regenerate request payload jobId={}",
                job.id,
            )
            return
        }
        val outputVersion = req.outputVersion

        // 첫 재생성 — current 가 없으면 직전 imageUrl 을 v1 으로 lazy push (배치 생성본 보존).
        if (storyboardPageImageVersionRepository.getCurrent(pageId) == null && !previousImageUrl.isNullOrBlank()) {
            storyboardPageImageVersionRepository.pushVersion(
                pageId = pageId,
                version = 1,
                url = previousImageUrl,
                prompt = null,        // 배치 생성본은 사용자 프롬프트 없음
                jobId = null,         // 배치 잡 id 는 추적 안 함 (별도 필요해지면 추가)
            )
        }

        // 새 outputVersion 으로 push.
        storyboardPageImageVersionRepository.pushVersion(
            pageId = pageId,
            version = outputVersion,
            url = newImageUrl,
            prompt = req.userPrompt,
            jobId = job.id,
        )
    }

    /**
     * job.requestPayload (JSON) 를 StoryboardImageRegeneratePayload 로 deserialize.
     * 파싱 실패 시 null 반환 (호출자가 분기).
     */
    private fun extractRegeneratePayload(job: StoryGenerationJob): StoryboardImageRegeneratePayload? {
        val raw = job.requestPayload ?: return null
        return try {
            objectMapper.readValue(raw, StoryboardImageRegeneratePayload::class.java)
        } catch (e: Exception) {
            log.warn("Failed to parse StoryboardImageRegeneratePayload jobId={}: {}", job.id, e.message)
            null
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

        // 3) 동화 메타 row — SUMMARY 잡 SUCCESS 시 이미 한글 줄거리(summaryKo) 로 만들어져 있어야 한다.
        //    옵션 ② 디자인 변경 (사용자 줄거리 직접 편집 허용):
        //     - story_board.story = 한글 줄거리 (사용자 편집 대상). 본문 합본으로 덮어쓰지 않는다.
        //     - 본문은 storyboard_pages 가 단일 source — Step 4 가 페이지별로 표시.
        //     - 전체 본문이 필요한 곳은 storyboard_pages.korean_text 를 page_number 순으로 join.
        //    storyBoard 가 없는 케이스는 SUMMARY 가 선행되지 않았다는 뜻이라 STORY 가 발행 자체가
        //    안 됐어야 한다 (StoryboardGenerationService.generate 의 SUMMARY_REQUIRED guard).
        //    여기까지 도달했다면 데이터 부정합이므로 IllegalStateException 으로 명시.
        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(job.storyId)
            ?: throw IllegalStateException(
                "STORY 잡 SUCCESS 처리 중 storyBoard 가 없음 — SUMMARY 가 선행돼야 함. storyId=${job.storyId}"
            )
        storyBoard.updateAt = LocalDate.now()
        // storyBoard.story 는 SUMMARY 시점에 들어간 한글 줄거리를 그대로 유지 (옵션 ②).

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

        // 5) Story.title / Story.synopsis 는 STORY (본문) 잡 SUCCESS 시 건드리지 않는다.
        //    - 본문 생성은 직전 SUMMARY 잡 결과를 grounding 으로 받았을 뿐, title/synopsis 의 SOT 가 아님.
        //    - title    SOT: SUMMARY 잡 SUCCESS (handleSummarySuccess step 3) — AI 영문 title 저장.
        //    - synopsis SOT: SUMMARY 잡 SUCCESS + 사용자 PATCH 편집.
        //    - 본문 페이로드의 title 은 이미지 생성 grounding (StoryboardImageGenerationService) 컨텍스트로만 사용.
        //    본문 합본 텍스트가 필요하면 storyboard_pages.korean_text 를 join 해서 산출.

        log.info(
            "Job {} SUCCESS — storyId={}, storyLen={}, pages={}, costUsd={}",
            job.id, job.storyId, koreanBody.length, payload.pages.size, payload.usage.costUsd,
        )
    }

    private fun handleSceneImageSuccess(job: StoryGenerationJob, envelope: StoryboardImageResultEnvelope) {
        val resultData = envelope.payload?.result
        if (resultData == null) {
            markFailed(job, "PAYLOAD_MISSING", "이미지 결과 payload 가 없습니다.")
            return
        }

        val scene = sceneRepository.findById(job.sceneId!!).orElse(null)
        if (scene == null) {
            markFailed(job, "SCENE_NOT_FOUND", "씬을 찾을 수 없습니다.")
            return
        }

        scene.illustrationUrl = resultData.imageUrl

        job.status = JobStatus.SUCCESS
        job.finishedAt = LocalDateTime.now()

        // Redis illust versions push (best-effort)
        try {
            val currentVersion = illustrationVersionRedisRepository.getCurrent(scene.id) ?: 1
            val newVersion = currentVersion + 1
            illustrationVersionRedisRepository.pushVersion(
                sceneId = scene.id,
                version = newVersion,
                url = resultData.imageUrl,
                prompt = null,
                jobId = job.id,
            )
        } catch (e: Exception) {
            log.warn("Redis illust version push failed for sceneId={}: {}", scene.id, e.message)
        }

        log.info(
            "Scene image job {} SUCCESS — storyId={}, sceneId={}",
            job.id, job.storyId, job.sceneId,
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
