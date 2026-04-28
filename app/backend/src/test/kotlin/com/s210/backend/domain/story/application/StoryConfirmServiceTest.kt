package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.redis.IllustrationVersionRedisRepository
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.Scene
import com.s210.backend.domain.story.entity.StoryBoard
import com.s210.backend.domain.story.entity.StoryOutro
import com.s210.backend.domain.story.entity.StoryboardPage
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneSentenceRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryOutroRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.story.model.StoryStatus
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.doThrow
import org.mockito.junit.jupiter.MockitoExtension
import tools.jackson.databind.ObjectMapper
import java.time.LocalDate

/**
 * Unit tests for StoryConfirmService validation logic (Task 11)
 * and DB conversion logic (Task 12).
 * Redis / TTS publish paths are covered in Tasks 13-14.
 */
@ExtendWith(MockitoExtension::class)
class StoryConfirmServiceTest {

    private val storyRepository: StoryRepository = mock(StoryRepository::class.java)
    private val sceneRepository: SceneRepository = mock(SceneRepository::class.java)
    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val storyBoardRepository: StoryBoardRepository = mock(StoryBoardRepository::class.java)
    private val storyboardPageRepository: StoryboardPageRepository = mock(StoryboardPageRepository::class.java)
    private val sceneSentenceRepository: SceneSentenceRepository = mock(SceneSentenceRepository::class.java)
    private val storyOutroRepository: StoryOutroRepository = mock(StoryOutroRepository::class.java)
    private val illustrationVersionRedisRepository: IllustrationVersionRedisRepository = mock(IllustrationVersionRedisRepository::class.java)
    private val objectMapper: ObjectMapper = ObjectMapper()

    private val service = StoryConfirmService(
        storyRepository = storyRepository,
        sceneRepository = sceneRepository,
        jobRepository = jobRepository,
        storyBoardRepository = storyBoardRepository,
        storyboardPageRepository = storyboardPageRepository,
        sceneSentenceRepository = sceneSentenceRepository,
        storyOutroRepository = storyOutroRepository,
        illustrationVersionRedisRepository = illustrationVersionRedisRepository,
        objectMapper = objectMapper,
    )

    private val userId = 1L
    private val storyId = 10L

    // -----------------------------------------------------------------------
    // 1. Story not found / not owned
    // -----------------------------------------------------------------------

    @Test
    fun `throws STORY_NOT_FOUND when story does not exist or not owned`() {
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(null)

        val ex = assertThrows<BusinessException> {
            service.confirmStoryboard(storyId, userId)
        }

        assertEquals(StoryErrorCode.STORY_NOT_FOUND, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // 2. Story status is not DRAFT
    // -----------------------------------------------------------------------

    @Test
    fun `throws INVALID_STORY_STATE when story status is not DRAFT`() {
        val story = createStory(status = StoryStatus.PUBLISHED, voiceProfileId = 5L)
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(story)

        val ex = assertThrows<BusinessException> {
            service.confirmStoryboard(storyId, userId)
        }

        assertEquals(StoryErrorCode.INVALID_STORY_STATE, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // 3. Voice profile not set
    // -----------------------------------------------------------------------

    @Test
    fun `throws INVALID_STORY_STATE when voice_profile_id is null`() {
        val story = createStory(status = StoryStatus.DRAFT, voiceProfileId = null)
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(story)

        val ex = assertThrows<BusinessException> {
            service.confirmStoryboard(storyId, userId)
        }

        assertEquals(StoryErrorCode.INVALID_STORY_STATE, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // 4. Latest STORYBOARD_STORY job is not SUCCESS
    // -----------------------------------------------------------------------

    @Test
    fun `throws INVALID_STORY_STATE when latest STORY job is not SUCCESS`() {
        val story = createStory(status = StoryStatus.DRAFT, voiceProfileId = 5L)
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(story)

        // STORYBOARD_STORY job is FAILED
        val failedStoryJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_STORY, status = JobStatus.FAILED)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY))
            .thenReturn(failedStoryJob)

        val ex = assertThrows<BusinessException> {
            service.confirmStoryboard(storyId, userId)
        }

        assertEquals(StoryErrorCode.INVALID_STORY_STATE, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // 5. Scenes already exist (idempotency guard)
    // -----------------------------------------------------------------------

    @Test
    fun `throws INVALID_STORY_STATE when scenes already exist`() {
        val story = createStory(status = StoryStatus.DRAFT, voiceProfileId = 5L)
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(story)

        val successStoryJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_STORY, status = JobStatus.SUCCESS)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY))
            .thenReturn(successStoryJob)

        val successImageJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_IMAGE, status = JobStatus.SUCCESS)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_IMAGE))
            .thenReturn(successImageJob)

        `when`(sceneRepository.countByStoryId(storyId)).thenReturn(3L)

        val ex = assertThrows<BusinessException> {
            service.confirmStoryboard(storyId, userId)
        }

        assertEquals(StoryErrorCode.INVALID_STORY_STATE, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // 6. DB conversion: scenes + scene_sentences from storyboard_pages (Task 12)
    // -----------------------------------------------------------------------

    @Test
    fun `confirm inserts scenes from storyboard pages`() {
        // Validation setup
        val story = createStory(status = StoryStatus.DRAFT, voiceProfileId = 5L)
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(story)

        val resultPayload = """
            {
              "pages": [
                { "pageNumber": 1, "sentences": [
                    { "englishText": "A walks.", "koreanText": "A가 걷는다." },
                    { "englishText": "B runs.", "koreanText": "B가 달린다." }
                ]},
                { "pageNumber": 2, "sentences": [
                    { "englishText": "C swims.", "koreanText": "C가 수영한다." },
                    { "englishText": "D flies.", "koreanText": "D가 난다." }
                ]},
                { "pageNumber": 3, "sentences": [
                    { "englishText": "E sings.", "koreanText": "E가 노래한다." },
                    { "englishText": "F dances.", "koreanText": "F가 춤춘다." }
                ]}
              ]
            }
        """.trimIndent()

        val storyJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_STORY, status = JobStatus.SUCCESS,
            resultPayload = resultPayload)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY))
            .thenReturn(storyJob)

        val imageJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_IMAGE, status = JobStatus.SUCCESS)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_IMAGE))
            .thenReturn(imageJob)

        `when`(sceneRepository.countByStoryId(storyId)).thenReturn(0L)

        // StoryBoard + pages
        val storyBoard = StoryBoard(id = 100L, storyId = storyId, prompt = "p", story = "s",
            createAt = LocalDate.now())
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId))
            .thenReturn(storyBoard)

        val pages = listOf(
            StoryboardPage(id = 1L, storyBoardId = 100L, pageNumber = 1, imageUrl = "https://img/1.png"),
            StoryboardPage(id = 2L, storyBoardId = 100L, pageNumber = 2, imageUrl = "https://img/2.png"),
            StoryboardPage(id = 3L, storyBoardId = 100L, pageNumber = 3, imageUrl = "https://img/3.png"),
        )
        `when`(storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(100L)).thenReturn(pages)

        // sceneRepository.save returns scene with id
        val sceneCaptor = ArgumentCaptor.forClass(Scene::class.java)
        `when`(sceneRepository.save(sceneCaptor.capture())).thenAnswer { invocation ->
            val s = invocation.getArgument<Scene>(0)
            Scene(id = s.pageNumber.toLong(), storyId = s.storyId, pageNumber = s.pageNumber,
                illustrationUrl = s.illustrationUrl)
        }

        // TTS job
        val ttsJob = createJob(storyId = storyId, jobType = JobType.TTS, status = JobStatus.PENDING)
        `when`(jobRepository.save(org.mockito.ArgumentMatchers.argThat { j: StoryGenerationJob ->
            j.jobType == JobType.TTS
        })).thenReturn(ttsJob)

        // StoryOutro doesn't exist
        `when`(storyOutroRepository.findByStoryIdAndDeletedAtIsNull(storyId)).thenReturn(null)
        `when`(storyOutroRepository.save(org.mockito.ArgumentMatchers.any(StoryOutro::class.java)))
            .thenAnswer { it.getArgument(0) }

        val result = service.confirmStoryboard(storyId, userId)

        // scene saved 3 times
        verify(sceneRepository, times(3)).save(org.mockito.ArgumentMatchers.any(Scene::class.java))
        // illustration_url matches
        val savedScenes = sceneCaptor.allValues
        assertEquals("https://img/1.png", savedScenes[0].illustrationUrl)
        assertEquals("https://img/2.png", savedScenes[1].illustrationUrl)
        assertEquals("https://img/3.png", savedScenes[2].illustrationUrl)
        // sentence saved 6 times (3 pages × 2 sentences)
        verify(sceneSentenceRepository, times(6))
            .save(org.mockito.ArgumentMatchers.any(com.s210.backend.domain.story.entity.SceneSentence::class.java))
        // result counts
        assertEquals(3, result.sceneCount)
        assertEquals(6, result.sentenceCount)
    }

    // -----------------------------------------------------------------------
    // 7. StoryOutro created when missing (Task 12)
    // -----------------------------------------------------------------------

    @Test
    fun `confirm creates outro when missing`() {
        setupValidationPassMocks(resultPayload = minimalPayload(pageCount = 1))

        `when`(storyOutroRepository.findByStoryIdAndDeletedAtIsNull(storyId)).thenReturn(null)
        val outroCaptor = ArgumentCaptor.forClass(StoryOutro::class.java)
        `when`(storyOutroRepository.save(outroCaptor.capture())).thenAnswer { it.getArgument(0) }

        service.confirmStoryboard(storyId, userId)

        verify(storyOutroRepository, times(1)).save(org.mockito.ArgumentMatchers.any(StoryOutro::class.java))
        assertEquals("", outroCaptor.value.outroText)
    }

    // -----------------------------------------------------------------------
    // 8. StoryOutro NOT created when already exists (Task 12)
    // -----------------------------------------------------------------------

    @Test
    fun `confirm skips outro when already exists`() {
        setupValidationPassMocks(resultPayload = minimalPayload(pageCount = 1))

        val existingOutro = StoryOutro(id = 99L, storyId = storyId, outroText = "existing")
        `when`(storyOutroRepository.findByStoryIdAndDeletedAtIsNull(storyId)).thenReturn(existingOutro)

        service.confirmStoryboard(storyId, userId)

        verify(storyOutroRepository, never()).save(org.mockito.ArgumentMatchers.any(StoryOutro::class.java))
    }

    // -----------------------------------------------------------------------
    // 9. Redis versions init on confirm (Task 13)
    // -----------------------------------------------------------------------

    @Test
    fun `confirm initializes redis versions for each scene`() {
        // Setup validation pass (3 scenes)
        val story = createStory(status = StoryStatus.DRAFT, voiceProfileId = 5L)
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(story)

        val resultPayload = minimalPayload(pageCount = 3)
        val storyJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_STORY,
            status = JobStatus.SUCCESS, resultPayload = resultPayload)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY))
            .thenReturn(storyJob)

        val imageJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_IMAGE, status = JobStatus.SUCCESS)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_IMAGE))
            .thenReturn(imageJob)

        `when`(sceneRepository.countByStoryId(storyId)).thenReturn(0L)

        val storyBoard = StoryBoard(id = 300L, storyId = storyId, prompt = "p", story = "s",
            createAt = LocalDate.now())
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId))
            .thenReturn(storyBoard)

        val pages = (1..3).map { n ->
            StoryboardPage(id = n.toLong(), storyBoardId = 300L, pageNumber = n,
                imageUrl = "https://img/$n.png")
        }
        `when`(storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(300L)).thenReturn(pages)

        `when`(sceneRepository.save(org.mockito.ArgumentMatchers.any(Scene::class.java))).thenAnswer { invocation ->
            val s = invocation.getArgument<Scene>(0)
            Scene(id = s.pageNumber.toLong(), storyId = s.storyId, pageNumber = s.pageNumber,
                illustrationUrl = s.illustrationUrl)
        }

        val ttsJob = createJob(storyId = storyId, jobType = JobType.TTS, status = JobStatus.PENDING)
        `when`(jobRepository.save(org.mockito.ArgumentMatchers.argThat { j: StoryGenerationJob ->
            j.jobType == JobType.TTS
        })).thenReturn(ttsJob)

        `when`(storyOutroRepository.findByStoryIdAndDeletedAtIsNull(storyId)).thenReturn(null)
        `when`(storyOutroRepository.save(org.mockito.ArgumentMatchers.any(StoryOutro::class.java)))
            .thenAnswer { it.getArgument(0) }

        service.confirmStoryboard(storyId, userId)

        // pushVersion called 3 times (once per scene)
        verify(illustrationVersionRedisRepository, times(3)).pushVersion(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.eq(1),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq(null),
            org.mockito.ArgumentMatchers.anyLong()
        )
    }

    @Test
    fun `confirm continues even if redis push fails`() {
        // Setup validation pass (3 scenes)
        val story = createStory(status = StoryStatus.DRAFT, voiceProfileId = 5L)
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(story)

        val resultPayload = minimalPayload(pageCount = 3)
        val storyJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_STORY,
            status = JobStatus.SUCCESS, resultPayload = resultPayload)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY))
            .thenReturn(storyJob)

        val imageJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_IMAGE, status = JobStatus.SUCCESS)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_IMAGE))
            .thenReturn(imageJob)

        `when`(sceneRepository.countByStoryId(storyId)).thenReturn(0L)

        val storyBoard = StoryBoard(id = 300L, storyId = storyId, prompt = "p", story = "s",
            createAt = LocalDate.now())
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId))
            .thenReturn(storyBoard)

        val pages = (1..3).map { n ->
            StoryboardPage(id = n.toLong(), storyBoardId = 300L, pageNumber = n,
                imageUrl = "https://img/$n.png")
        }
        `when`(storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(300L)).thenReturn(pages)

        `when`(sceneRepository.save(org.mockito.ArgumentMatchers.any(Scene::class.java))).thenAnswer { invocation ->
            val s = invocation.getArgument<Scene>(0)
            Scene(id = s.pageNumber.toLong(), storyId = s.storyId, pageNumber = s.pageNumber,
                illustrationUrl = s.illustrationUrl)
        }

        val ttsJob = createJob(storyId = storyId, jobType = JobType.TTS, status = JobStatus.PENDING)
        `when`(jobRepository.save(org.mockito.ArgumentMatchers.argThat { j: StoryGenerationJob ->
            j.jobType == JobType.TTS
        })).thenReturn(ttsJob)

        `when`(storyOutroRepository.findByStoryIdAndDeletedAtIsNull(storyId)).thenReturn(null)
        `when`(storyOutroRepository.save(org.mockito.ArgumentMatchers.any(StoryOutro::class.java)))
            .thenAnswer { it.getArgument(0) }

        // Mock pushVersion to throw on first call, succeed on rest
        var callCount = 0
        doThrow(RuntimeException("Redis connection failed"))
            .`when`(illustrationVersionRedisRepository).pushVersion(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyInt(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()
            )

        // Should complete successfully despite first Redis call throwing
        val result = service.confirmStoryboard(storyId, userId)
        assertEquals(3, result.sceneCount)

        // All 3 pushVersion calls attempted (best-effort, no early exit)
        verify(illustrationVersionRedisRepository, times(3)).pushVersion(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        )
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private fun createStory(status: StoryStatus, voiceProfileId: Long?): Story =
        Story(
            id = storyId,
            userId = userId,
            status = status,
            voiceProfileId = voiceProfileId,
            difficulty = Difficulty.BEGINNER,
            mainCharacterJson = """{"name":"아이","age":5,"gender":"MALE"}""",
            companionsJson = "[]",
        )

    private fun createJob(
        storyId: Long,
        jobType: JobType,
        status: JobStatus,
        resultPayload: String? = null,
    ): StoryGenerationJob =
        StoryGenerationJob(
            storyId = storyId,
            jobType = jobType,
            status = status,
            resultPayload = resultPayload,
        )

    /**
     * Minimal JSON payload with [pageCount] pages, each having 1 sentence.
     */
    private fun minimalPayload(pageCount: Int): String {
        val pages = (1..pageCount).joinToString(",") { n ->
            """{ "pageNumber": $n, "sentences": [{ "englishText": "Text $n.", "koreanText": "텍스트 $n." }] }"""
        }
        return """{ "pages": [$pages] }"""
    }

    /**
     * Sets up all mocks needed to pass validation and enter conversion logic,
     * with [pageCount] storyboard pages each containing 1 sentence.
     */
    private fun setupValidationPassMocks(resultPayload: String, pageCount: Int = 1) {
        val story = createStory(status = StoryStatus.DRAFT, voiceProfileId = 5L)
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(story)

        val storyJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_STORY,
            status = JobStatus.SUCCESS, resultPayload = resultPayload)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY))
            .thenReturn(storyJob)

        val imageJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_IMAGE, status = JobStatus.SUCCESS)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_IMAGE))
            .thenReturn(imageJob)

        `when`(sceneRepository.countByStoryId(storyId)).thenReturn(0L)

        val storyBoard = StoryBoard(id = 200L, storyId = storyId, prompt = "p", story = "s",
            createAt = LocalDate.now())
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId))
            .thenReturn(storyBoard)

        val pages = (1..pageCount).map { n ->
            StoryboardPage(id = n.toLong(), storyBoardId = 200L, pageNumber = n,
                imageUrl = "https://img/$n.png")
        }
        `when`(storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(200L)).thenReturn(pages)

        `when`(sceneRepository.save(org.mockito.ArgumentMatchers.any(Scene::class.java))).thenAnswer { invocation ->
            val s = invocation.getArgument<Scene>(0)
            Scene(id = s.pageNumber.toLong(), storyId = s.storyId, pageNumber = s.pageNumber,
                illustrationUrl = s.illustrationUrl)
        }

        val ttsJob = createJob(storyId = storyId, jobType = JobType.TTS, status = JobStatus.PENDING)
        `when`(jobRepository.save(org.mockito.ArgumentMatchers.argThat { j: StoryGenerationJob ->
            j.jobType == JobType.TTS
        })).thenReturn(ttsJob)

        // Task 13: Redis versions init (best-effort, default to no-op)
        `when`(storyOutroRepository.findByStoryIdAndDeletedAtIsNull(storyId)).thenReturn(null)
        `when`(storyOutroRepository.save(org.mockito.ArgumentMatchers.any(StoryOutro::class.java)))
            .thenAnswer { it.getArgument(0) }
    }
}
