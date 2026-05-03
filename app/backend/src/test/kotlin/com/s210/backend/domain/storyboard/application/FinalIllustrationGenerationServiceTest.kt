package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.preset.entity.StylePreset
import com.s210.backend.domain.preset.infrastructure.repository.StylePresetRepository
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.entity.StoryBoard
import com.s210.backend.domain.story.entity.StoryboardPage
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.storyboard.application.dto.ChildInfo
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationJobMeta
import com.s210.backend.domain.storyboard.application.dto.ReadingLevel
import com.s210.backend.domain.storyboard.application.dto.StoryboardPageDto
import com.s210.backend.domain.storyboard.application.dto.StoryboardPayload
import com.s210.backend.domain.storyboard.application.dto.UsageInfo
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.`when`
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.amqp.rabbit.core.RabbitTemplate
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.time.LocalDate
import java.util.Optional

/**
 * Unit tests for FinalIllustrationGenerationService.enqueue() — idempotency guard,
 * style-change branching, and readiness checks.
 *
 * All dependencies are mocked; no Spring context needed.
 * Mirrors the style of StoryboardGenerationServiceGuardTest and StoryboardSummaryServiceTest.
 */
@ExtendWith(MockitoExtension::class)
class FinalIllustrationGenerationServiceTest {

    private val storyRepository: StoryRepository = mock(StoryRepository::class.java)
    private val stylePresetRepository: StylePresetRepository = mock(StylePresetRepository::class.java)
    private val storyBoardRepository: StoryBoardRepository = mock(StoryBoardRepository::class.java)
    private val storyboardPageRepository: StoryboardPageRepository = mock(StoryboardPageRepository::class.java)
    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val rabbitTemplate: RabbitTemplate = mock(RabbitTemplate::class.java)
    private val objectMapper = jacksonObjectMapper()
    private val storyParticipantParser: StoryParticipantParser = mock(StoryParticipantParser::class.java)

    private val service = FinalIllustrationGenerationService(
        storyRepository = storyRepository,
        stylePresetRepository = stylePresetRepository,
        storyBoardRepository = storyBoardRepository,
        storyboardPageRepository = storyboardPageRepository,
        jobRepository = jobRepository,
        rabbitTemplate = rabbitTemplate,
        objectMapper = objectMapper,
        storyParticipantParser = storyParticipantParser,
    )

    private val storyId = 10L
    private val stylePresetId = 1L
    private val altStylePresetId = 2L

    // -----------------------------------------------------------------------
    // 멱등성: 같은 stylePresetId 로 두 번 호출 → 두 번째는 기존 jobId 재사용
    // -----------------------------------------------------------------------

    @Test
    fun `같은 stylePresetId 로 두 번 호출하면 두 번째는 기존 jobId 를 재사용한다`() {
        stubOwnedStory()
        stubStylePreset(stylePresetId)
        stubStoryBoardAndPages(allImagesReady = true)
        stubLastSuccessStoryJob()
        stubParticipants()

        // 첫 번째 save — jobId=100 반환.
        val firstSavedJob = buildJob(100L, JobType.FINAL_ILLUSTRATION, JobStatus.PENDING)
        `when`(jobRepository.save(any())).thenReturn(firstSavedJob)

        // 첫 번째 호출: FINAL_ILLUSTRATION 잡이 아직 없음 → 새 잡 생성.
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.FINAL_ILLUSTRATION)
        ).thenReturn(null)
        val firstJobId = service.enqueue(storyId, stylePresetId)

        // 두 번째 호출: 방금 만들어진 PENDING 잡이 있고, 같은 stylePresetId → 재사용.
        val savedMeta = FinalIllustrationJobMeta(
            stylePresetId = stylePresetId,
            payload = com.s210.backend.domain.storyboard.application.dto.FinalIllustrationGeneratePayload(
                storyId = storyId,
                seed = 0,
                items = emptyList(),
            ),
        )
        val existingJob = StoryGenerationJob(
            id = 100L,
            storyId = storyId,
            jobType = JobType.FINAL_ILLUSTRATION,
            status = JobStatus.PENDING,
            requestPayload = objectMapper.writeValueAsString(savedMeta),
        )
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.FINAL_ILLUSTRATION)
        ).thenReturn(existingJob)
        val secondJobId = service.enqueue(storyId, stylePresetId)

        // 두 번째 jobId 는 첫 번째와 같아야 한다.
        assertEquals(firstJobId, secondJobId)
        assertEquals(100L, secondJobId)

        // 두 번째 호출에서 jobRepository.save 는 불리지 않아야 한다 (한 번만 호출됨).
        verify(jobRepository, org.mockito.Mockito.times(1)).save(any())
    }

    @Test
    fun `PENDING 잡이 있고 같은 stylePresetId 면 rabbitTemplate 을 두 번째에는 호출하지 않는다`() {
        stubOwnedStory()
        stubStylePreset(stylePresetId)
        stubStoryBoardAndPages(allImagesReady = true)
        stubLastSuccessStoryJob()
        stubParticipants()

        // 첫 번째 호출 준비: 잡 없음 → 새 잡 저장.
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.FINAL_ILLUSTRATION)
        ).thenReturn(null)
        val firstSaved = buildJob(77L, JobType.FINAL_ILLUSTRATION, JobStatus.PENDING)
        `when`(jobRepository.save(any())).thenReturn(firstSaved)
        service.enqueue(storyId, stylePresetId)

        // 두 번째 호출: 기존 PENDING 잡 재사용 → publish 스킵.
        val metaJson = objectMapper.writeValueAsString(
            FinalIllustrationJobMeta(
                stylePresetId = stylePresetId,
                payload = com.s210.backend.domain.storyboard.application.dto.FinalIllustrationGeneratePayload(
                    storyId = storyId, seed = 0, items = emptyList()
                ),
            )
        )
        val pendingJob = StoryGenerationJob(
            id = 77L,
            storyId = storyId,
            jobType = JobType.FINAL_ILLUSTRATION,
            status = JobStatus.PENDING,
            requestPayload = metaJson,
        )
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.FINAL_ILLUSTRATION)
        ).thenReturn(pendingJob)
        service.enqueue(storyId, stylePresetId)

        // rabbitTemplate.convertAndSend 는 첫 번째 호출에서 1 회만 발생해야 한다.
        verify(rabbitTemplate, org.mockito.Mockito.times(1)).convertAndSend(
            any(String::class.java), any(String::class.java), any(Any::class.java)
        )
    }

    // -----------------------------------------------------------------------
    // 다른 stylePresetId: 새 잡 생성
    // -----------------------------------------------------------------------

    @Test
    fun `다른 stylePresetId 로 호출하면 새 잡을 생성하고 다른 jobId 를 반환한다`() {
        stubOwnedStory()

        // 기존 잡: stylePresetId=1 의 SUCCESS 잡.
        val existingMeta = FinalIllustrationJobMeta(
            stylePresetId = stylePresetId,
            payload = com.s210.backend.domain.storyboard.application.dto.FinalIllustrationGeneratePayload(
                storyId = storyId, seed = 0, items = emptyList()
            ),
        )
        val existingJob = StoryGenerationJob(
            id = 50L,
            storyId = storyId,
            jobType = JobType.FINAL_ILLUSTRATION,
            status = JobStatus.SUCCESS,
            requestPayload = objectMapper.writeValueAsString(existingMeta),
        )
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.FINAL_ILLUSTRATION)
        ).thenReturn(existingJob)

        // 다른 스타일로 새 요청 → 멱등 가드를 통과해야 함.
        stubStylePreset(altStylePresetId)
        stubStoryBoardAndPages(allImagesReady = true)
        stubLastSuccessStoryJob()
        stubParticipants()

        val newJob = buildJob(99L, JobType.FINAL_ILLUSTRATION, JobStatus.PENDING)
        `when`(jobRepository.save(any())).thenReturn(newJob)

        val newJobId = service.enqueue(storyId, altStylePresetId)

        assertNotEquals(existingJob.id, newJobId)
        assertEquals(99L, newJobId)
        verify(jobRepository, org.mockito.Mockito.times(1)).save(any())
    }

    // -----------------------------------------------------------------------
    // storyboard_pages 중 imageUrl 이 비어있으면 STORYBOARD_IMAGES_NOT_READY
    // -----------------------------------------------------------------------

    @Test
    fun `storyboard_pages 중 하나라도 imageUrl 이 blank 이면 STORYBOARD_IMAGES_NOT_READY 를 던진다`() {
        stubOwnedStory()
        // 멱등 가드 통과 (잡 없음).
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.FINAL_ILLUSTRATION)
        ).thenReturn(null)
        stubStylePreset(stylePresetId)

        // 페이지 2개 중 하나는 imageUrl 이 blank.
        val storyBoard = StoryBoard(
            id = 1L,
            storyId = storyId,
            prompt = "",
            story = "story",
            createAt = LocalDate.now(),
        )
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId))
            .thenReturn(storyBoard)

        val pages = listOf(
            buildPage(storyBoardId = 1L, pageNumber = 1, imageUrl = "s3://bucket/page1.png"),
            buildPage(storyBoardId = 1L, pageNumber = 2, imageUrl = ""),   // blank → 오류 유발
        )
        `when`(storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(1L)).thenReturn(pages)

        val ex = assertThrows<BusinessException> {
            service.enqueue(storyId, stylePresetId)
        }

        assertEquals(StoryErrorCode.STORYBOARD_IMAGES_NOT_READY, ex.errorCode)
    }

    @Test
    fun `storyboard_pages 중 imageUrl 이 null 이면 STORYBOARD_IMAGES_NOT_READY 를 던진다`() {
        stubOwnedStory()
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.FINAL_ILLUSTRATION)
        ).thenReturn(null)
        stubStylePreset(stylePresetId)

        val storyBoard = StoryBoard(
            id = 2L,
            storyId = storyId,
            prompt = "",
            story = "story",
            createAt = LocalDate.now(),
        )
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId))
            .thenReturn(storyBoard)

        val pages = listOf(
            buildPage(storyBoardId = 2L, pageNumber = 1, imageUrl = null),  // null → 오류 유발
        )
        `when`(storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(2L)).thenReturn(pages)

        val ex = assertThrows<BusinessException> {
            service.enqueue(storyId, stylePresetId)
        }

        assertEquals(StoryErrorCode.STORYBOARD_IMAGES_NOT_READY, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // (bonus) STYLE_PRESET_NOT_FOUND: 존재하지 않는 스타일 프리셋
    // -----------------------------------------------------------------------

    @Test
    fun `존재하지 않는 stylePresetId 면 STYLE_PRESET_NOT_FOUND 를 던진다`() {
        stubOwnedStory()
        // 멱등 가드 통과.
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.FINAL_ILLUSTRATION)
        ).thenReturn(null)
        // 스타일 프리셋 조회 실패.
        `when`(stylePresetRepository.findById(stylePresetId)).thenReturn(Optional.empty())

        val ex = assertThrows<BusinessException> {
            service.enqueue(storyId, stylePresetId)
        }

        assertEquals(StoryErrorCode.STYLE_PRESET_NOT_FOUND, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // Job 조립: INSERT 된 잡에 jobType/status 가 올바른지
    // -----------------------------------------------------------------------

    @Test
    fun `enqueue 호출 시 FINAL_ILLUSTRATION 타입 PENDING 상태의 잡이 save 된다`() {
        stubOwnedStory()
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.FINAL_ILLUSTRATION)
        ).thenReturn(null)
        stubStylePreset(stylePresetId)
        stubStoryBoardAndPages(allImagesReady = true)
        stubLastSuccessStoryJob()
        stubParticipants()

        val captor = ArgumentCaptor.forClass(StoryGenerationJob::class.java)
        val savedJob = buildJob(1L, JobType.FINAL_ILLUSTRATION, JobStatus.PENDING)
        `when`(jobRepository.save(captor.capture())).thenReturn(savedJob)

        service.enqueue(storyId, stylePresetId)

        val captured = captor.value
        assertEquals(JobType.FINAL_ILLUSTRATION, captured.jobType)
        assertEquals(JobStatus.PENDING, captured.status)
        assertEquals(storyId, captured.storyId)
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private fun stubOwnedStory() {
        val story = Story(
            id = storyId,
            userId = 1L,
            travelPlace = "제주도",
            difficulty = Difficulty.BEGINNER,
            mainCharacterJson = """[{"name":"아이","age":5,"gender":"MALE"}]""",
            companionsJson = "[]",
        )
        `when`(storyRepository.findById(storyId)).thenReturn(Optional.of(story))
    }

    private fun stubStylePreset(presetId: Long) {
        val preset = StylePreset(
            id = presetId,
            code = "watercolor",
            name = "수채화",
        )
        `when`(stylePresetRepository.findById(presetId)).thenReturn(Optional.of(preset))
    }

    private fun stubStoryBoardAndPages(allImagesReady: Boolean) {
        val storyBoard = StoryBoard(
            id = 100L,
            storyId = storyId,
            prompt = "",
            story = "story",
            createAt = LocalDate.now(),
        )
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId))
            .thenReturn(storyBoard)

        val imageUrl = if (allImagesReady) "s3://bucket/page1.png" else ""
        val pages = listOf(
            buildPage(
                storyBoardId = 100L,
                pageNumber = 1,
                imageUrl = imageUrl,
            )
        )
        `when`(storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(100L)).thenReturn(pages)
    }

    private fun stubLastSuccessStoryJob() {
        val payload = StoryboardPayload(
            title = "Title",
            synopsis = "Synopsis",
            moralTheme = "courage",
            storyQuest = "adventure",
            recurringMotif = "rainbow",
            pageCount = 1,
            pageCountReason = "test",
            readingLevel = ReadingLevel(
                basedOnAge = 5,
                sentencesPerPage = "2-3",
                wordsPerSentence = "5-7",
                reason = "easy",
            ),
            totalWordCount = 50,
            pages = listOf(
                StoryboardPageDto(
                    pageNumber = 1,
                    sourcePhotoIds = emptyList(),
                    sceneSummary = "scene",
                    englishText = "english",
                    koreanText = "한국어",
                    imagePrompt = "prompt",
                    sentences = emptyList(),
                    sentenceCount = 1,
                    wordCount = 10,
                )
            ),
            usage = UsageInfo(
                model = "gpt-4",
                inputTokens = 100,
                outputTokens = 200,
                totalTokens = 300,
                costUsd = 0.01,
                promptTemplateVersion = "v1",
            ),
        )
        val successJob = StoryGenerationJob(
            id = 999L,
            storyId = storyId,
            jobType = JobType.STORYBOARD_STORY,
            status = JobStatus.SUCCESS,
            resultPayload = objectMapper.writeValueAsString(payload),
        )
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, JobStatus.SUCCESS
            )
        ).thenReturn(successJob)
    }

    private fun stubParticipants() {
        org.mockito.Mockito.doReturn(listOf(ChildInfo("아이", 5, "MALE")))
            .`when`(storyParticipantParser).parseChildren(org.mockito.ArgumentMatchers.anyString())
        org.mockito.Mockito.doReturn(emptyList<String>())
            .`when`(storyParticipantParser).parseCompanions(org.mockito.ArgumentMatchers.anyString())
    }

    private fun buildJob(id: Long, jobType: JobType, status: JobStatus): StoryGenerationJob =
        StoryGenerationJob(
            id = id,
            storyId = storyId,
            jobType = jobType,
            status = status,
        )

    private fun buildPage(
        storyBoardId: Long,
        pageNumber: Int,
        imageUrl: String?,
    ): StoryboardPage = StoryboardPage(
        storyBoardId = storyBoardId,
        pageNumber = pageNumber,
        sceneSummary = "scene summary",
        englishText = "english text",
        koreanText = "한국어 텍스트",
        imagePrompt = "image prompt",
        imageUrl = imageUrl,
    )
}
