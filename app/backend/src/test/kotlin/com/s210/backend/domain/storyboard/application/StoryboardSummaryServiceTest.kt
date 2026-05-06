package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.PhotoAlbumItem
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.entity.StoryBoard
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.PhotoAlbumItemRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.story.model.PhotoPurpose
import com.s210.backend.domain.storyboard.application.dto.StorySummaryPayload
import com.s210.backend.domain.storyboard.application.dto.UsageInfo
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.*
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.amqp.rabbit.core.RabbitTemplate
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.time.LocalDate
import java.util.Optional

/**
 * Unit tests for StoryboardSummaryService.
 *
 * Covers:
 *  - generateSummary: job INSERT + rabbitTemplate publish on STORY_SUMMARY_GENERATE routing key
 *  - regenerateSummary: SUMMARY_NOT_FOUND when no prior SUCCESS job (AC9)
 *  - regenerateSummary: job INSERT + publish on STORY_SUMMARY_REGENERATE with previousSummary
 *  - findSummary 5 cases: no job / PENDING / RUNNING / SUCCESS / FAILED
 */
@ExtendWith(MockitoExtension::class)
class StoryboardSummaryServiceTest {

    private val rabbitTemplate: RabbitTemplate = mock(RabbitTemplate::class.java)
    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val storyRepository: StoryRepository = mock(StoryRepository::class.java)
    private val photoRepository: PhotoAlbumItemRepository = mock(PhotoAlbumItemRepository::class.java)
    private val storyBoardRepository: StoryBoardRepository = mock(StoryBoardRepository::class.java)
    private val objectMapper = jacksonObjectMapper()
    private val storyParticipantParser: StoryParticipantParser = mock(StoryParticipantParser::class.java)

    private val service = StoryboardSummaryService(
        rabbitTemplate = rabbitTemplate,
        jobRepository = jobRepository,
        storyRepository = storyRepository,
        photoRepository = photoRepository,
        storyBoardRepository = storyBoardRepository,
        objectMapper = objectMapper,
        storyParticipantParser = storyParticipantParser,
    )

    private val userId = 1L
    private val storyId = 10L

    // -----------------------------------------------------------------------
    // generateSummary — job INSERT with STORYBOARD_STORY_SUMMARY + PENDING
    // -----------------------------------------------------------------------

    @Test
    fun `generateSummary inserts job with jobType STORYBOARD_STORY_SUMMARY and status PENDING`() {
        stubOwnedStory()
        stubPhotos()
        stubParticipants()

        val savedJob = buildJob(1L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.PENDING, null)
        val captor = ArgumentCaptor.forClass(StoryGenerationJob::class.java)
        `when`(jobRepository.save(captor.capture())).thenReturn(savedJob)

        service.generateSummary(userId, storyId, null)

        val captured = captor.value
        assertEquals(JobType.STORYBOARD_STORY_SUMMARY, captured.jobType)
        assertEquals(JobStatus.PENDING, captured.status)
        assertEquals(storyId, captured.storyId)
    }

    @Test
    fun `generateSummary publishes to STORY_SUMMARY_GENERATE routing key`() {
        stubOwnedStory()
        stubPhotos()
        stubParticipants()

        val savedJob = buildJob(1L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.PENDING, null)
        `when`(jobRepository.save(any())).thenReturn(savedJob)

        service.generateSummary(userId, storyId, null)

        verify(rabbitTemplate).convertAndSend(
            eq(com.s210.backend.common.mq.RabbitMQConfig.REQUEST_EXCHANGE),
            eq(com.s210.backend.common.mq.RoutingKeys.STORY_SUMMARY_GENERATE),
            any(Any::class.java)
        )
    }

    @Test
    fun `generateSummary returns StartGenerationResult with PENDING status`() {
        stubOwnedStory()
        stubPhotos()
        stubParticipants()

        val savedJob = buildJob(99L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.PENDING, null)
        `when`(jobRepository.save(any())).thenReturn(savedJob)

        val result = service.generateSummary(userId, storyId, null)

        assertEquals(99L, result.jobId)
        assertEquals(JobType.STORYBOARD_STORY_SUMMARY.name, result.jobType)
        assertEquals(JobStatus.PENDING.name, result.status)
    }

    // -----------------------------------------------------------------------
    // regenerateSummary — SUMMARY_NOT_FOUND when no prior SUCCESS job (AC9)
    // -----------------------------------------------------------------------

    @Test
    fun `regenerateSummary throws SUMMARY_NOT_FOUND when no prior SUCCESS summary job exists`() {
        stubOwnedStory()
        // reference 가드를 통과시켜 검사 대상인 SUMMARY_NOT_FOUND 분기까지 도달하도록.
        stubCharacterRefCount(1)

        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(null)

        val ex = assertThrows<BusinessException> {
            service.regenerateSummary(userId, storyId, "더 밝게 써줘")
        }

        assertEquals(StoryErrorCode.SUMMARY_NOT_FOUND, ex.errorCode)
    }

    @Test
    fun `regenerateSummary inserts new job and publishes on STORY_SUMMARY_REGENERATE when prior SUCCESS exists`() {
        stubOwnedStory()
        stubPhotos()
        stubParticipants()

        val previousPayload = buildSummaryPayload()
        val previousPayloadJson = objectMapper.writeValueAsString(previousPayload)
        val previousJob = buildJob(50L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS, previousPayloadJson)

        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(previousJob)

        val savedJob = buildJob(51L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.PENDING, null)
        `when`(jobRepository.save(any())).thenReturn(savedJob)

        val result = service.regenerateSummary(userId, storyId, "더 밝게 써줘")

        verify(rabbitTemplate).convertAndSend(
            eq(com.s210.backend.common.mq.RabbitMQConfig.REQUEST_EXCHANGE),
            eq(com.s210.backend.common.mq.RoutingKeys.STORY_SUMMARY_REGENERATE),
            any(Any::class.java)
        )
        assertEquals(JobStatus.PENDING.name, result.status)
    }

    @Test
    fun `regenerateSummary throws SUMMARY_NOT_FOUND when prior SUCCESS job has null resultPayload`() {
        stubOwnedStory()
        // reference 가드 통과시켜 SUMMARY_NOT_FOUND 분기까지 도달.
        stubCharacterRefCount(1)

        val brokenJob = buildJob(52L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(brokenJob)

        val ex = assertThrows<BusinessException> {
            service.regenerateSummary(userId, storyId, "프롬프트")
        }

        assertEquals(StoryErrorCode.SUMMARY_NOT_FOUND, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // generateSummary / regenerateSummary — STORY_ALREADY_IN_PROGRESS guard
    // (활성 본문 잡 도는 동안엔 줄거리 생성/재생성 거부 — 진행 중 본문이 stale grounding 받지 않도록)
    // -----------------------------------------------------------------------

    @Test
    fun `generateSummary throws STORY_ALREADY_IN_PROGRESS when active PENDING story job exists`() {
        stubOwnedStory()

        val activePendingJob = buildJob(60L, JobType.STORYBOARD_STORY, JobStatus.PENDING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activePendingJob)

        val ex = assertThrows<BusinessException> {
            service.generateSummary(userId, storyId, null)
        }

        assertEquals(StoryErrorCode.STORY_ALREADY_IN_PROGRESS, ex.errorCode)
        // 가드에서 즉시 차단 — payload 빌드 / publish 모두 일어나지 않아야 함
        verify(jobRepository, never()).save(any())
        verify(rabbitTemplate, never()).convertAndSend(anyString(), anyString(), any(Any::class.java))
    }

    @Test
    fun `generateSummary throws STORY_ALREADY_IN_PROGRESS when active RUNNING story job exists`() {
        stubOwnedStory()

        val activeRunningJob = buildJob(61L, JobType.STORYBOARD_STORY, JobStatus.RUNNING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activeRunningJob)

        val ex = assertThrows<BusinessException> {
            service.generateSummary(userId, storyId, null)
        }

        assertEquals(StoryErrorCode.STORY_ALREADY_IN_PROGRESS, ex.errorCode)
    }

    @Test
    fun `regenerateSummary throws STORY_ALREADY_IN_PROGRESS when active PENDING story job exists`() {
        stubOwnedStory()

        val activePendingJob = buildJob(70L, JobType.STORYBOARD_STORY, JobStatus.PENDING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activePendingJob)

        val ex = assertThrows<BusinessException> {
            service.regenerateSummary(userId, storyId, "더 밝게 써줘")
        }

        assertEquals(StoryErrorCode.STORY_ALREADY_IN_PROGRESS, ex.errorCode)
        // 활성 본문 잡 가드에서 즉시 차단 — 직전 SUMMARY SUCCESS 조회조차 일어나지 않아야 함
        verify(jobRepository, never()).findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
        )
        verify(jobRepository, never()).save(any())
        verify(rabbitTemplate, never()).convertAndSend(anyString(), anyString(), any(Any::class.java))
    }

    @Test
    fun `regenerateSummary throws STORY_ALREADY_IN_PROGRESS when active RUNNING story job exists`() {
        stubOwnedStory()

        val activeRunningJob = buildJob(71L, JobType.STORYBOARD_STORY, JobStatus.RUNNING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activeRunningJob)

        val ex = assertThrows<BusinessException> {
            service.regenerateSummary(userId, storyId, "프롬프트")
        }

        assertEquals(StoryErrorCode.STORY_ALREADY_IN_PROGRESS, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // findSummary — 5 cases
    // -----------------------------------------------------------------------

    @Test
    fun `findSummary returns all nulls when no summary job exists`() {
        stubOwnedStory()

        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(null)

        val result = service.findSummary(userId, storyId)

        assertNull(result.summaryKo)
        assertNull(result.jobStatus)
        assertNull(result.jobId)
    }

    @Test
    fun `findSummary returns null summaryKo and PENDING status when latest job is PENDING`() {
        stubOwnedStory()

        val pendingJob = buildJob(10L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.PENDING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(pendingJob)

        val result = service.findSummary(userId, storyId)

        assertNull(result.summaryKo)
        assertEquals("PENDING", result.jobStatus)
        assertEquals("10", result.jobId)
    }

    @Test
    fun `findSummary returns null summaryKo and RUNNING status when latest job is RUNNING`() {
        stubOwnedStory()

        val runningJob = buildJob(11L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.RUNNING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(runningJob)

        val result = service.findSummary(userId, storyId)

        assertNull(result.summaryKo)
        assertEquals("RUNNING", result.jobStatus)
        assertEquals("11", result.jobId)
    }

    @Test
    fun `findSummary returns synopsis (user-edited SOT) when latest job is SUCCESS and synopsis is set`() {
        // editSummary 또는 listener 가 stories.synopsis 에 채워둔 값을 SOT 로 본다.
        stubOwnedStoryWithSynopsis("사용자가 직접 다듬은 줄거리")

        // 잡 페이로드엔 옛 AI 원본이 들어있어도 무시되어야 — synopsis 우선.
        val payloadJson = objectMapper.writeValueAsString(
            buildSummaryPayload().copy(summaryKo = "AI 가 만든 옛 줄거리"),
        )
        val successJob = buildJob(12L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS, payloadJson)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(successJob)

        val result = service.findSummary(userId, storyId)

        assertEquals("사용자가 직접 다듬은 줄거리", result.summaryKo)
        assertEquals("SUCCESS", result.jobStatus)
        assertEquals("12", result.jobId)
    }

    @Test
    fun `findSummary falls back to job resultPayload when synopsis is empty (legacy data path)`() {
        stubOwnedStory()  // synopsis = null

        val payloadJson = objectMapper.writeValueAsString(
            buildSummaryPayload().copy(summaryKo = "한글 요약 내용"),
        )
        val successJob = buildJob(12L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS, payloadJson)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(successJob)

        val result = service.findSummary(userId, storyId)

        // synopsis 가 비어있을 때만 잡 페이로드로 fallback — legacy 데이터 / SUCCESS 직후 listener race 윈도우 방어.
        assertEquals("한글 요약 내용", result.summaryKo)
        assertEquals("SUCCESS", result.jobStatus)
        assertEquals("12", result.jobId)
    }

    @Test
    fun `findSummary returns FAILED status and null summaryKo when latest job is FAILED and no prior SUCCESS`() {
        stubOwnedStory()

        val failedJob = buildJob(13L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.FAILED, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(failedJob)

        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(null)

        val result = service.findSummary(userId, storyId)

        assertNull(result.summaryKo)
        assertEquals("FAILED", result.jobStatus)
        assertEquals("13", result.jobId)
    }

    @Test
    fun `findSummary returns synopsis when latest is FAILED but user has edited synopsis previously`() {
        // 시나리오: 사용자가 SUCCESS 후 줄거리를 편집해 synopsis 에 보관 → 재생성 시도 → FAILED.
        // synopsis 는 그대로 살아있어야 하고, FE 가 사용자 편집본을 다시 볼 수 있어야 한다.
        stubOwnedStoryWithSynopsis("사용자 편집본")

        val failedJob = buildJob(14L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.FAILED, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(failedJob)

        val result = service.findSummary(userId, storyId)

        assertEquals("사용자 편집본", result.summaryKo)
        assertEquals("FAILED", result.jobStatus)
        assertEquals("14", result.jobId)
        // synopsis 가 채워져 있으면 직전 SUCCESS 잡 페이로드 조회는 건너뛰어야 함 (불필요 쿼리 방지).
        verify(jobRepository, never()).findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
        )
    }

    @Test
    fun `findSummary falls back to prior SUCCESS resultPayload when latest is FAILED and synopsis is empty (legacy)`() {
        stubOwnedStory()  // synopsis = null

        val failedJob = buildJob(14L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.FAILED, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(failedJob)

        // 직전 SUCCESS 잡의 result_payload 에서 summaryKo 추출 — legacy 데이터 호환 경로.
        val priorPayloadJson = objectMapper.writeValueAsString(
            buildSummaryPayload().copy(summaryKo = "이전 성공 요약"),
        )
        val priorSuccessJob = buildJob(9L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS, priorPayloadJson)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(priorSuccessJob)

        val result = service.findSummary(userId, storyId)

        assertEquals("이전 성공 요약", result.summaryKo)
        assertEquals("FAILED", result.jobStatus)
        assertEquals("14", result.jobId)
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

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

    /** synopsis 가 미리 채워져 있는 상태 — findSummary 의 SOT 우선 경로 검증용. */
    private fun stubOwnedStoryWithSynopsis(synopsis: String) {
        val story = Story(
            id = storyId,
            userId = userId,
            travelPlace = "제주도",
            difficulty = Difficulty.BEGINNER,
            mainCharacterJson = """[{"name":"아이","age":5,"gender":"MALE"}]""",
            companionsJson = "[]",
            synopsis = synopsis,
        )
        `when`(storyRepository.findById(storyId)).thenReturn(Optional.of(story))
    }

    private fun stubPhotos() {
        // 추억 사진(=스토리 본문 베이스) 모음 — buildPayload 가 STORYBOARD + BOTH 만 필터.
        val photo = PhotoAlbumItem(
            id = 1L,
            storyId = storyId,
            imageUrl = "s3://bucket/photo.jpg",
            displayOrder = 0L,
        )
        `when`(
            photoRepository.findAllByStoryIdAndPurposeInAndDeletedAtIsNullOrderByDisplayOrderAsc(
                storyId,
                listOf(PhotoPurpose.STORYBOARD, PhotoPurpose.BOTH),
            )
        ).thenReturn(listOf(photo))
        // 대표 사진(reference) 카운트 ≥ 1 — Step 2→3 전환 가드 통과용.
        stubCharacterRefCount(1)
    }

    /**
     * 대표 사진(`CHARACTER_REF + BOTH`) 카운트 stub — Step 3 진입 가드용.
     * 0 으로 두면 generate/regenerateSummary 가 CHARACTER_PHOTOS_REQUIRED 로 실패한다.
     * SUMMARY_NOT_FOUND / STORY_ALREADY_IN_PROGRESS 등 다른 가드를 검증하는 테스트에선
     * 이 stub 으로 reference 검증을 통과시킨 뒤 검사하려는 가드까지 도달하게 한다.
     */
    private fun stubCharacterRefCount(count: Long) {
        `when`(
            photoRepository.countByStoryIdAndPurposeInAndDeletedAtIsNull(
                storyId,
                listOf(PhotoPurpose.CHARACTER_REF, PhotoPurpose.BOTH),
            )
        ).thenReturn(count)
    }

    private fun stubParticipants() {
        // Use doReturn(...).when(...) style to avoid Kotlin null-check on non-null String params
        doReturn(listOf(com.s210.backend.domain.storyboard.application.dto.ChildInfo("아이", 5, "MALE")))
            .`when`(storyParticipantParser).parseChildren(anyString())
        doReturn(emptyList<String>())
            .`when`(storyParticipantParser).parseCompanions(anyString())
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

    private fun buildStoryBoard(summaryKo: String): StoryBoard =
        StoryBoard(
            storyId = storyId,
            prompt = "",
            story = summaryKo,
            createAt = LocalDate.now(),
        )
}
