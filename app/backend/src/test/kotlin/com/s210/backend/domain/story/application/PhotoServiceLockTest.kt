package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.s3.S3Service
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.application.dto.CreatePhotoCommand
import com.s210.backend.domain.story.application.dto.ModifyPhotoCommand
import com.s210.backend.domain.story.entity.PhotoAlbumItem
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.PhotoAlbumItemRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.story.model.PhotoPurpose
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.EnumSource
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.junit.jupiter.MockitoSettings
import org.mockito.quality.Strictness
import org.springframework.context.ApplicationEventPublisher
import java.util.Optional

/**
 * Unit tests for PhotoService — Step 2 Lock 거동.
 *
 * 가드: `STORYBOARD_STORY_SUMMARY` 잡이 PENDING/RUNNING/SUCCESS 중 하나로 존재하면
 *       Step 2 의 모든 mutation 이 `STEP_LOCKED_BY_SUMMARY` 로 거부된다.
 *       FAILED 만 있는 상태 또는 잡 자체가 없는 상태에선 통과.
 *
 * 6 개 mutation entry 각각 lock 가드를 호출하는지 검증한다.
 */
@ExtendWith(MockitoExtension::class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PhotoServiceLockTest {

    private val photoRepository: PhotoAlbumItemRepository = mock(PhotoAlbumItemRepository::class.java)
    private val storyRepository: StoryRepository = mock(StoryRepository::class.java)
    private val s3Service: S3Service = mock(S3Service::class.java)
    private val eventPublisher: ApplicationEventPublisher = mock(ApplicationEventPublisher::class.java)
    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)

    private val service = PhotoService(
        photoRepository = photoRepository,
        storyRepository = storyRepository,
        s3Service = s3Service,
        eventPublisher = eventPublisher,
        jobRepository = jobRepository,
    )

    private val userId = 1L
    private val storyId = 10L
    private val photoId = 100L

    // ---------------------------------------------------------------------------
    // (A) addPhoto — SUMMARY lock 의 axis(PENDING/RUNNING/SUCCESS) 를 모두 검증.
    //     다른 entry 들은 helper 호출만 확인하면 되므로 1 status (RUNNING) 으로 smoke.
    // ---------------------------------------------------------------------------

    @ParameterizedTest
    @EnumSource(value = JobStatus::class, names = ["PENDING", "RUNNING", "SUCCESS"])
    fun `addPhoto throws STEP_LOCKED_BY_SUMMARY when SUMMARY job exists in active state`(status: JobStatus) {
        stubOwnedStory()
        stubSummaryJob(status)

        val ex = assertThrows<BusinessException> {
            service.addPhoto(buildCreateCommand())
        }
        assertEquals(StoryErrorCode.STEP_LOCKED_BY_SUMMARY, ex.errorCode)
    }

    @Test
    fun `addPhoto allows mutation when only FAILED SUMMARY exists`() {
        stubOwnedStory()
        stubSummaryJob(JobStatus.FAILED)  // FAILED 는 lock 가드의 status 리스트(PENDING/RUNNING/SUCCESS) 에 안 잡힘
        stubNoExistingPhotos()
        // FAILED 만 있어도 락 helper 는 PENDING/RUNNING/SUCCESS 만 조회하므로 null 반환 → 통과해야 함.
        // 그 외 부수 효과(displayOrder 계산 / save) 가 호출되도록 stub.
        `when`(photoRepository.save(any(PhotoAlbumItem::class.java))).thenAnswer { it.arguments[0] }

        // throw 하지 않으면 통과로 간주.
        service.addPhoto(buildCreateCommand())
    }

    @Test
    fun `addPhoto allows mutation when no SUMMARY job exists`() {
        stubOwnedStory()
        stubNoSummaryJob()
        stubNoExistingPhotos()
        `when`(photoRepository.save(any(PhotoAlbumItem::class.java))).thenAnswer { it.arguments[0] }

        service.addPhoto(buildCreateCommand())
    }

    // ---------------------------------------------------------------------------
    // (B) 나머지 entry 5 개 — SUMMARY=RUNNING 으로 가드가 호출되는지 smoke 검증.
    // ---------------------------------------------------------------------------

    @Test
    fun `presignUpload throws STEP_LOCKED_BY_SUMMARY when SUMMARY is RUNNING`() {
        stubOwnedStory()
        stubSummaryJob(JobStatus.RUNNING)

        val ex = assertThrows<BusinessException> {
            service.presignUpload(userId, storyId, "image/png", PhotoPurpose.STORYBOARD)
        }
        assertEquals(StoryErrorCode.STEP_LOCKED_BY_SUMMARY, ex.errorCode)
    }

    @Test
    fun `toggleCharacterRef throws STEP_LOCKED_BY_SUMMARY when SUMMARY is RUNNING`() {
        stubOwnedStory()
        stubSummaryJob(JobStatus.RUNNING)
        // photoRepository.findById 까지 도달하지 않고 가드에서 throw — stub 불필요.

        val ex = assertThrows<BusinessException> {
            service.toggleCharacterRef(userId, storyId, photoId, on = true)
        }
        assertEquals(StoryErrorCode.STEP_LOCKED_BY_SUMMARY, ex.errorCode)
    }

    @Test
    fun `removePhoto throws STEP_LOCKED_BY_SUMMARY when SUMMARY is RUNNING`() {
        stubOwnedStory()
        stubSummaryJob(JobStatus.RUNNING)

        val ex = assertThrows<BusinessException> {
            service.removePhoto(userId, storyId, photoId)
        }
        assertEquals(StoryErrorCode.STEP_LOCKED_BY_SUMMARY, ex.errorCode)
    }

    @Test
    fun `modifyPhoto throws STEP_LOCKED_BY_SUMMARY when SUMMARY is RUNNING`() {
        stubOwnedStory()
        stubSummaryJob(JobStatus.RUNNING)

        val ex = assertThrows<BusinessException> {
            service.modifyPhoto(
                ModifyPhotoCommand(
                    userId = userId,
                    storyId = storyId,
                    photoId = photoId,
                    description = "updated",
                    tagsJson = null,
                )
            )
        }
        assertEquals(StoryErrorCode.STEP_LOCKED_BY_SUMMARY, ex.errorCode)
    }

    @Test
    fun `reorderPhotos throws STEP_LOCKED_BY_SUMMARY when SUMMARY is RUNNING`() {
        stubOwnedStory()
        stubSummaryJob(JobStatus.RUNNING)

        val ex = assertThrows<BusinessException> {
            service.reorderPhotos(userId, storyId, listOf(1L, 2L, 3L))
        }
        assertEquals(StoryErrorCode.STEP_LOCKED_BY_SUMMARY, ex.errorCode)
    }

    // ---------------------------------------------------------------------------
    // Fixture builders
    // ---------------------------------------------------------------------------

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

    /**
     * SUMMARY 잡이 주어진 status 로 존재하도록 stub.
     * `ensureStorySummaryNotStarted` 는 status IN (PENDING, RUNNING, SUCCESS) 로 조회하므로
     * - PENDING/RUNNING/SUCCESS → non-null 반환 → throws
     * - FAILED → null 반환 → pass-through
     */
    private fun stubSummaryJob(status: JobStatus) {
        val job = StoryGenerationJob(
            id = 1L,
            storyId = storyId,
            jobType = JobType.STORYBOARD_STORY_SUMMARY,
            status = status,
        )
        val activeStatuses = listOf(JobStatus.PENDING, JobStatus.RUNNING, JobStatus.SUCCESS)
        // Mockito 는 literal arg 를 자동으로 eq 처리. Kotlin 의 nullable matcher 회피용.
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId,
                JobType.STORYBOARD_STORY_SUMMARY,
                activeStatuses,
            )
        ).thenReturn(if (status in activeStatuses) job else null)
    }

    private fun stubNoSummaryJob() {
        // Mockito 는 unstubbed 호출에 default(null) 을 반환 — lenient 모드라 별도 stub 불필요.
        // 함수는 의도를 명시하기 위해 호출 site 에 둔다 (실제 동작은 no-op).
    }

    private fun stubNoExistingPhotos() {
        `when`(
            photoRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByDisplayOrderDesc(storyId)
        ).thenReturn(null)
    }

    private fun buildCreateCommand() = CreatePhotoCommand(
        userId = userId,
        storyId = storyId,
        s3Key = "stories/$storyId/photos/abc.png",
        purpose = PhotoPurpose.STORYBOARD,
    )
}
