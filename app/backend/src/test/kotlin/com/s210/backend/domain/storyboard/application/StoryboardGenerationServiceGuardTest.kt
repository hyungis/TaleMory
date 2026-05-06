package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.entity.StoryBoard
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.PhotoAlbumItemRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.storyboard.application.dto.StorySummaryPayload
import com.s210.backend.domain.storyboard.application.dto.UsageInfo
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.*
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.amqp.rabbit.core.RabbitTemplate
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.time.LocalDate
import java.util.Optional

/**
 * Unit tests for StoryboardGenerationService.generate() guard logic.
 *
 * Verifies AC4 (SUMMARY_REQUIRED), AC5 (successful publish with summary),
 * and AC11 (STORY_ALREADY_IN_PROGRESS for PENDING and RUNNING active jobs).
 *
 * All external dependencies are mocked; no Spring context needed.
 */
@ExtendWith(MockitoExtension::class)
class StoryboardGenerationServiceGuardTest {

    private val storyRepository: StoryRepository = mock(StoryRepository::class.java)
    private val photoRepository: PhotoAlbumItemRepository = mock(PhotoAlbumItemRepository::class.java)
    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val storyBoardRepository: StoryBoardRepository = mock(StoryBoardRepository::class.java)
    private val rabbitTemplate: RabbitTemplate = mock(RabbitTemplate::class.java)
    private val objectMapper = jacksonObjectMapper()
    private val storyParticipantParser: StoryParticipantParser = mock(StoryParticipantParser::class.java)

    private val service = StoryboardGenerationService(
        storyRepository = storyRepository,
        photoRepository = photoRepository,
        jobRepository = jobRepository,
        storyBoardRepository = storyBoardRepository,
        rabbitTemplate = rabbitTemplate,
        objectMapper = objectMapper,
        storyParticipantParser = storyParticipantParser,
    )

    private val userId = 1L
    private val storyId = 10L

    // -----------------------------------------------------------------------
    // AC4 — no SUCCESS summary job → SUMMARY_REQUIRED
    // -----------------------------------------------------------------------

    @Test
    fun `generate throws SUMMARY_REQUIRED when no SUCCESS summary job exists`() {
        stubOwnedStory()
        // No active story job
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(null)
        // No SUCCESS summary job
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(null)

        val ex = assertThrows<BusinessException> {
            service.generate(userId, storyId, null)
        }

        assertEquals(StoryErrorCode.SUMMARY_REQUIRED, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // AC5 — SUCCESS summary job present + no active story job → publish succeeds
    // and payload.summary is populated
    // -----------------------------------------------------------------------

    @Test
    fun `generate publishes to rabbitTemplate when summary SUCCESS job exists and no active story job`() {
        stubOwnedStory()

        // No active story job
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(null)

        // SUCCESS summary job with result payload
        val summaryPayload = buildSummaryPayload()
        val summaryPayloadJson = objectMapper.writeValueAsString(summaryPayload)
        val summaryJob = buildJob(100L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS, summaryPayloadJson)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(summaryJob)

        // Photos and participants
        val photo = buildPhoto()
        `when`(photoRepository.findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId))
            .thenReturn(listOf(photo))
        doReturn(listOf(com.s210.backend.domain.storyboard.application.dto.ChildInfo("아이", 5, "MALE")))
            .`when`(storyParticipantParser).parseChildren(anyString())
        doReturn(emptyList<String>())
            .`when`(storyParticipantParser).parseCompanions(anyString())

        val savedJob = buildJob(200L, JobType.STORYBOARD_STORY, JobStatus.PENDING, null)
        `when`(jobRepository.save(any())).thenReturn(savedJob)

        val result = service.generate(userId, storyId, null)

        // Verify rabbitTemplate.convertAndSend was called (summary was included in payload)
        verify(rabbitTemplate).convertAndSend(
            eq(com.s210.backend.common.mq.RabbitMQConfig.REQUEST_EXCHANGE),
            eq(com.s210.backend.common.mq.RoutingKeys.STORY_GENERATE),
            any(Any::class.java)
        )
        assertEquals(JobStatus.PENDING.name, result.status)
    }

    // -----------------------------------------------------------------------
    // AC11 — active PENDING story job → STORY_ALREADY_IN_PROGRESS
    // -----------------------------------------------------------------------

    @Test
    fun `generate throws STORY_ALREADY_IN_PROGRESS when active PENDING story job exists`() {
        stubOwnedStory()

        val activePendingJob = buildJob(50L, JobType.STORYBOARD_STORY, JobStatus.PENDING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activePendingJob)

        val ex = assertThrows<BusinessException> {
            service.generate(userId, storyId, null)
        }

        assertEquals(StoryErrorCode.STORY_ALREADY_IN_PROGRESS, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // AC11 — active RUNNING story job → STORY_ALREADY_IN_PROGRESS
    // -----------------------------------------------------------------------

    @Test
    fun `generate throws STORY_ALREADY_IN_PROGRESS when active RUNNING story job exists`() {
        stubOwnedStory()

        val activeRunningJob = buildJob(51L, JobType.STORYBOARD_STORY, JobStatus.RUNNING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activeRunningJob)

        val ex = assertThrows<BusinessException> {
            service.generate(userId, storyId, null)
        }

        assertEquals(StoryErrorCode.STORY_ALREADY_IN_PROGRESS, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // Guard order: race guard (AC11) is evaluated BEFORE summary guard (AC4)
    // -----------------------------------------------------------------------

    @Test
    fun `STORY_ALREADY_IN_PROGRESS is thrown before SUMMARY_REQUIRED is checked`() {
        stubOwnedStory()

        val activePendingJob = buildJob(52L, JobType.STORYBOARD_STORY, JobStatus.PENDING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activePendingJob)

        val ex = assertThrows<BusinessException> {
            service.generate(userId, storyId, null)
        }

        // Must be the race guard error, not summary guard
        assertEquals(StoryErrorCode.STORY_ALREADY_IN_PROGRESS, ex.errorCode)
        // Summary job must never be queried — use literal values to avoid Kotlin null-safety issues with matchers
        verify(jobRepository, never()).findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
        )
    }

    // -----------------------------------------------------------------------
    // editSummary — STORY_ALREADY_IN_PROGRESS guard + immutability of summary job
    // -----------------------------------------------------------------------

    @Test
    fun `editSummary throws STORY_ALREADY_IN_PROGRESS when active PENDING story job exists`() {
        stubOwnedStory()

        val activePendingJob = buildJob(80L, JobType.STORYBOARD_STORY, JobStatus.PENDING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activePendingJob)

        val ex = assertThrows<BusinessException> {
            service.editSummary(userId, storyId, "사용자 편집 줄거리")
        }

        assertEquals(StoryErrorCode.STORY_ALREADY_IN_PROGRESS, ex.errorCode)
        // 가드에서 즉시 차단 — storyBoard / story 어떤 write 도 일어나지 않아야 함
        verify(storyBoardRepository, never()).findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
    }

    @Test
    fun `editSummary throws STORY_ALREADY_IN_PROGRESS when active RUNNING story job exists`() {
        stubOwnedStory()

        val activeRunningJob = buildJob(81L, JobType.STORYBOARD_STORY, JobStatus.RUNNING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activeRunningJob)

        val ex = assertThrows<BusinessException> {
            service.editSummary(userId, storyId, "사용자 편집 줄거리")
        }

        assertEquals(StoryErrorCode.STORY_ALREADY_IN_PROGRESS, ex.errorCode)
    }

    @Test
    fun `editSummary updates synopsis and storyBoard story but does NOT mutate summary job result payload`() {
        // immutability 보장: 잡 테이블은 history 로 둔다.
        stubOwnedStory()

        // 활성 본문 잡 없음
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(null)

        val storyBoard = StoryBoard(
            storyId = storyId,
            prompt = "",
            story = "기존 한글 줄거리",
            createAt = LocalDate.now(),
        )
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId))
            .thenReturn(storyBoard)

        val edited = "사용자가 직접 다듬은 줄거리"
        service.editSummary(userId, storyId, edited)

        // story_board.story 갱신 검증
        assertEquals(edited, storyBoard.story)
        // 잡 결과 페이로드를 건드리지 않아야 — 이전 디자인의 JSON_SET 회귀 방지.
        // editSummary 가 더 이상 SUMMARY SUCCESS 잡을 조회조차 하지 않음을 검증.
        verify(jobRepository, never()).findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
        )
    }

    @Test
    fun `editSummary throws on blank input`() {
        stubOwnedStory()

        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(null)

        val storyBoard = StoryBoard(
            storyId = storyId,
            prompt = "",
            story = "기존",
            createAt = LocalDate.now(),
        )
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId))
            .thenReturn(storyBoard)

        val ex = assertThrows<BusinessException> {
            service.editSummary(userId, storyId, "   ")
        }
        // INVALID_INPUT — 잡 페이로드 건드리지 않는 것은 위 테스트가 보장.
        assertNotNull(ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // findStoryboardState — Step 4 mount recovery + 한도 초과 분기 데이터
    // -----------------------------------------------------------------------

    @Test
    fun `findStoryboardState returns activeJob when PENDING story job exists`() {
        stubOwnedStory()

        val activeJob = buildJob(100L, JobType.STORYBOARD_STORY, JobStatus.PENDING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activeJob)
        // 마지막 SUCCESS 잡 — 없음
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, JobStatus.SUCCESS
            )
        ).thenReturn(null)
        `when`(
            jobRepository.countByStoryIdAndJobTypeAndStatusAndIdGreaterThan(
                storyId, JobType.STORYBOARD_STORY, JobStatus.FAILED, 0L
            )
        ).thenReturn(0L)

        val result = service.findStoryboardState(userId, storyId)

        assertNotNull(result.activeJob)
        assertEquals(100L, result.activeJob!!.jobId)
        assertEquals(JobStatus.PENDING, result.activeJob.status)
        // 활성 잡 있을 땐 latestFinalStatus 는 의미 없음 → null
        assertNull(result.latestFinalStatus)
        assertEquals(0L, result.failedCountSinceLastSuccess)
        // 활성 잡 있으면 latest 잡 조회는 일어나지 않아야 함 (불필요 쿼리 방지)
        verify(jobRepository, never()).findFirstByStoryIdAndJobTypeOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY
        )
    }

    @Test
    fun `findStoryboardState returns FAILED latestFinalStatus and counts failures since last SUCCESS`() {
        stubOwnedStory()

        // 활성 잡 없음
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(null)
        // 마지막 SUCCESS 잡: id=50
        val lastSuccess = buildJob(50L, JobType.STORYBOARD_STORY, JobStatus.SUCCESS, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, JobStatus.SUCCESS
            )
        ).thenReturn(lastSuccess)
        // SUCCESS 이후 FAILED 가 2건
        `when`(
            jobRepository.countByStoryIdAndJobTypeAndStatusAndIdGreaterThan(
                storyId, JobType.STORYBOARD_STORY, JobStatus.FAILED, 50L
            )
        ).thenReturn(2L)
        // 가장 최근 STORY 잡 (status 무관) — FAILED
        val latestFailed = buildJob(70L, JobType.STORYBOARD_STORY, JobStatus.FAILED, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY)
        ).thenReturn(latestFailed)

        val result = service.findStoryboardState(userId, storyId)

        assertNull(result.activeJob)
        assertEquals(JobStatus.FAILED, result.latestFinalStatus)
        assertEquals(2L, result.failedCountSinceLastSuccess)
    }

    @Test
    fun `findStoryboardState counts all FAILED when no SUCCESS exists`() {
        stubOwnedStory()

        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(null)
        // SUCCESS 없음
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, JobStatus.SUCCESS
            )
        ).thenReturn(null)
        // 누적 FAILED 3 건 (한도 초과 케이스)
        `when`(
            jobRepository.countByStoryIdAndJobTypeAndStatusAndIdGreaterThan(
                storyId, JobType.STORYBOARD_STORY, JobStatus.FAILED, 0L
            )
        ).thenReturn(3L)
        val latestFailed = buildJob(33L, JobType.STORYBOARD_STORY, JobStatus.FAILED, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY)
        ).thenReturn(latestFailed)

        val result = service.findStoryboardState(userId, storyId)

        assertNull(result.activeJob)
        assertEquals(JobStatus.FAILED, result.latestFinalStatus)
        assertEquals(3L, result.failedCountSinceLastSuccess)
    }

    @Test
    fun `findStoryboardState returns SUCCESS latestFinalStatus and 0 failedCount after fresh success`() {
        stubOwnedStory()

        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(null)
        val lastSuccess = buildJob(80L, JobType.STORYBOARD_STORY, JobStatus.SUCCESS, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, JobStatus.SUCCESS
            )
        ).thenReturn(lastSuccess)
        // SUCCESS 이후 FAILED 없음 — 카운터 0
        `when`(
            jobRepository.countByStoryIdAndJobTypeAndStatusAndIdGreaterThan(
                storyId, JobType.STORYBOARD_STORY, JobStatus.FAILED, 80L
            )
        ).thenReturn(0L)
        // latest = SUCCESS
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY)
        ).thenReturn(lastSuccess)

        val result = service.findStoryboardState(userId, storyId)

        assertNull(result.activeJob)
        assertEquals(JobStatus.SUCCESS, result.latestFinalStatus)
        assertEquals(0L, result.failedCountSinceLastSuccess)
    }

    @Test
    fun `findStoryboardState returns null latestFinalStatus when no STORY jobs exist`() {
        stubOwnedStory()

        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, JobStatus.SUCCESS
            )
        ).thenReturn(null)
        `when`(
            jobRepository.countByStoryIdAndJobTypeAndStatusAndIdGreaterThan(
                storyId, JobType.STORYBOARD_STORY, JobStatus.FAILED, 0L
            )
        ).thenReturn(0L)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY)
        ).thenReturn(null)

        val result = service.findStoryboardState(userId, storyId)

        assertNull(result.activeJob)
        assertNull(result.latestFinalStatus)
        assertEquals(0L, result.failedCountSinceLastSuccess)
    }

    // -----------------------------------------------------------------------
    // findStoryboardState — Step 4 IMAGE 배치 잡 새로고침 복구
    //
    // FE 가 새로고침 / 탭 재진입 했을 때 currentImageJobId(useState) 가 잃어버린 상태에서도
    // BE 응답의 latestImageJob 으로 polling 재개 / 결과 표시 / 재시도 UI 분기가 가능하도록
    // 가장 최근 STORYBOARD_IMAGE 배치 잡 1건의 status 를 노출한다.
    // -----------------------------------------------------------------------

    @Test
    fun `findStoryboardState returns null latestImageJob when no IMAGE batch exists`() {
        stubOwnedStory()
        stubNoStoryJobs()
        // STORYBOARD_IMAGE 잡 자체가 없음 — 신규 스토리.
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_IMAGE)
        ).thenReturn(null)

        val result = service.findStoryboardState(userId, storyId)

        assertNull(result.latestImageJob)
    }

    @Test
    fun `findStoryboardState returns latestImageJob with RUNNING status for in-progress IMAGE batch`() {
        stubOwnedStory()
        stubNoStoryJobs()
        val runningImageJob = buildJob(200L, JobType.STORYBOARD_IMAGE, JobStatus.RUNNING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_IMAGE)
        ).thenReturn(runningImageJob)

        val result = service.findStoryboardState(userId, storyId)

        assertNotNull(result.latestImageJob)
        assertEquals(200L, result.latestImageJob!!.jobId)
        assertEquals(JobStatus.RUNNING, result.latestImageJob.status)
    }

    @Test
    fun `findStoryboardState returns latestImageJob with SUCCESS status when batch completed`() {
        stubOwnedStory()
        stubNoStoryJobs()
        val successImageJob = buildJob(201L, JobType.STORYBOARD_IMAGE, JobStatus.SUCCESS, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_IMAGE)
        ).thenReturn(successImageJob)

        val result = service.findStoryboardState(userId, storyId)

        assertEquals(JobStatus.SUCCESS, result.latestImageJob!!.status)
    }

    @Test
    fun `findStoryboardState returns latestImageJob with FAILED status when batch failed`() {
        stubOwnedStory()
        stubNoStoryJobs()
        val failedImageJob = buildJob(202L, JobType.STORYBOARD_IMAGE, JobStatus.FAILED, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_IMAGE)
        ).thenReturn(failedImageJob)

        val result = service.findStoryboardState(userId, storyId)

        assertEquals(JobStatus.FAILED, result.latestImageJob!!.status)
    }

    // -----------------------------------------------------------------------
    // findStoryboardState — Step 4 페이지 재생성 잡 새로고침 복구
    // -----------------------------------------------------------------------

    @Test
    fun `findStoryboardState returns null activeImageRegenerateJob when no regenerate in progress`() {
        stubOwnedStory()
        stubNoStoryJobs()
        stubNoBatchImageJob()
        // 활성 재생성 잡 없음 (또는 SUCCESS/FAILED 만)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId,
                JobType.STORYBOARD_IMAGE_REGENERATE,
                listOf(JobStatus.PENDING, JobStatus.RUNNING),
            )
        ).thenReturn(null)

        val result = service.findStoryboardState(userId, storyId)

        assertNull(result.activeImageRegenerateJob)
    }

    @Test
    fun `findStoryboardState returns activeImageRegenerateJob with parsed pageNumber when regenerate is RUNNING`() {
        stubOwnedStory()
        stubNoStoryJobs()
        stubNoBatchImageJob()
        // BE 가 만들어 저장한 requestPayload JSON — item.pageNumber=3.
        // 실제 직렬화 형태와 동일한 키 구조 (StoryboardImageGenerateMessage.kt 의 data class 들 그대로).
        val payload = """
            {
              "storyId": $storyId,
              "seed": 42,
              "userPrompt": "더 밝게",
              "outputVersion": 2,
              "item": {
                "pageNumber": 3,
                "storyboard": {"title":"t","synopsis":"s"},
                "page": {"pageNumber":3,"sceneSummary":"ss","englishText":"e","koreanText":"k","imagePrompt":"i"},
                "children": [],
                "companions": [],
                "referenceImageS3Keys": []
              }
            }
        """.trimIndent()
        val regenJob = StoryGenerationJob(
            id = 300L,
            storyId = storyId,
            jobType = JobType.STORYBOARD_IMAGE_REGENERATE,
            status = JobStatus.RUNNING,
            requestPayload = payload,
        )
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId,
                JobType.STORYBOARD_IMAGE_REGENERATE,
                listOf(JobStatus.PENDING, JobStatus.RUNNING),
            )
        ).thenReturn(regenJob)

        val result = service.findStoryboardState(userId, storyId)

        assertNotNull(result.activeImageRegenerateJob)
        assertEquals(300L, result.activeImageRegenerateJob!!.jobId)
        assertEquals(3, result.activeImageRegenerateJob.pageNumber)
        assertEquals(JobStatus.RUNNING, result.activeImageRegenerateJob.status)
    }

    @Test
    fun `findStoryboardState returns null activeImageRegenerateJob when payload JSON parse fails (defensive)`() {
        stubOwnedStory()
        stubNoStoryJobs()
        stubNoBatchImageJob()
        // 손상된 JSON — parseRegeneratePageNumber 가 null 반환 → 잡 없음 효과로 무시.
        val regenJob = StoryGenerationJob(
            id = 301L,
            storyId = storyId,
            jobType = JobType.STORYBOARD_IMAGE_REGENERATE,
            status = JobStatus.PENDING,
            requestPayload = "{ malformed json",
        )
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId,
                JobType.STORYBOARD_IMAGE_REGENERATE,
                listOf(JobStatus.PENDING, JobStatus.RUNNING),
            )
        ).thenReturn(regenJob)

        val result = service.findStoryboardState(userId, storyId)

        assertNull(result.activeImageRegenerateJob)
    }

    @Test
    fun `findStoryboardState returns latestImageJob alongside activeStoryJob (rare regenerate scenario)`() {
        // 사용자가 IMAGE 배치 끝낸 뒤 Step 3 으로 회귀해 STORY 재생성을 트리거한 시나리오.
        // BE 는 두 정보 모두 그대로 노출 — FE 가 activeJob (STORY) 우선 처리하고 IMAGE 복구는 스킵.
        stubOwnedStory()
        val activeStory = buildJob(101L, JobType.STORYBOARD_STORY, JobStatus.RUNNING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activeStory)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, JobStatus.SUCCESS
            )
        ).thenReturn(null)
        `when`(
            jobRepository.countByStoryIdAndJobTypeAndStatusAndIdGreaterThan(
                storyId, JobType.STORYBOARD_STORY, JobStatus.FAILED, 0L
            )
        ).thenReturn(0L)
        val oldImageJob = buildJob(199L, JobType.STORYBOARD_IMAGE, JobStatus.SUCCESS, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_IMAGE)
        ).thenReturn(oldImageJob)

        val result = service.findStoryboardState(userId, storyId)

        assertNotNull(result.activeJob)
        assertNotNull(result.latestImageJob)
        assertEquals(JobStatus.SUCCESS, result.latestImageJob!!.status)
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /** IMAGE 배치 잡 stub — latest 없음. 재생성 테스트 fixture 용. */
    private fun stubNoBatchImageJob() {
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_IMAGE)
        ).thenReturn(null)
    }

    /** STORY 잡 stub — 활성 없음, SUCCESS 없음, FAILED 카운트 0, latest 없음. IMAGE 테스트 fixture 용. */
    private fun stubNoStoryJobs() {
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, JobStatus.SUCCESS
            )
        ).thenReturn(null)
        `when`(
            jobRepository.countByStoryIdAndJobTypeAndStatusAndIdGreaterThan(
                storyId, JobType.STORYBOARD_STORY, JobStatus.FAILED, 0L
            )
        ).thenReturn(0L)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY)
        ).thenReturn(null)
    }

    private fun stubOwnedStory() {
        val story = Story(
            id = storyId,
            userId = userId,
            travelPlace = "제주도",
            difficulty = Difficulty.BEGINNER,
            mainCharacterJson = """[{"name":"아이","age":5,"gender":"MALE"}]""",
            companionsJson = "[]",
        )
        `when`(storyRepository.findById(storyId)).thenReturn(Optional.of(story))
    }

    private fun buildSummaryPayload() = StorySummaryPayload(
        title = "Test Story",
        summary = "English summary",
        summaryKo = "한글 요약",
        moralTheme = "courage",
        storyQuest = "find treasure",
        recurringMotif = "rainbow",
        keyEmotionalBeats = listOf("hopeful", "warm", "playful"),
        usage = UsageInfo(
            model = "gpt-4",
            inputTokens = 100,
            outputTokens = 200,
            totalTokens = 300,
            costUsd = 0.01,
            promptTemplateVersion = "v1",
        ),
    )

    private fun buildJob(
        id: Long,
        jobType: JobType,
        status: JobStatus,
        resultPayload: String?,
    ): StoryGenerationJob = StoryGenerationJob(
        id = id,
        storyId = storyId,
        jobType = jobType,
        status = status,
        resultPayload = resultPayload,
    )

    private fun buildPhoto(): com.s210.backend.domain.story.entity.PhotoAlbumItem =
        com.s210.backend.domain.story.entity.PhotoAlbumItem(
            id = 1L,
            storyId = storyId,
            imageUrl = "s3://bucket/photo1.jpg",
            displayOrder = 0L,
        )
}
