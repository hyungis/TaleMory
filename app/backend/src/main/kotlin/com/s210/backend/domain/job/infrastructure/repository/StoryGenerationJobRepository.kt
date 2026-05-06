package com.s210.backend.domain.job.infrastructure.repository

import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface StoryGenerationJobRepository : JpaRepository<StoryGenerationJob, Long> {

    /**
     * pessimistic write lock 을 걸고 잡을 조회 — `SELECT ... FOR UPDATE`.
     *
     * 사용처: `FinalIllustrationResultHandler` 가 페이지별 콜백을 받아 같은 잡 row 의
     * `result_payload` (Map<pageNumber, imageUrl>) 를 read-modify-write 로 누적할 때.
     * 단일 BE pod 에서는 `concurrentConsumers=1` 이라 race 가 없지만, 멀티 pod 으로
     * 수평 스케일하면 두 pod 이 동시에 같은 잡의 다른 페이지 결과를 처리할 수 있어
     * 한쪽의 누적 write 가 덮여 page 가 누락될 수 있다. 이 lock 으로 해당 잡 row 를
     * 트랜잭션 종료까지 직렬화한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT j FROM StoryGenerationJob j WHERE j.id = :id")
    fun findByIdForUpdate(@Param("id") id: Long): StoryGenerationJob?

    /**
     * 한 storyId 의 특정 jobType + status 작업 중 가장 최근 것을 조회.
     *
     * 이미지 생성 페이로드를 만들 때 "그 storyId 의 마지막으로 성공한 STORY 잡" 을 찾아
     * `result_payload` JSON 에서 title / synopsis / sourcePhotoIds 를 꺼내쓰기 위함.
     */
    fun findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
        storyId: Long,
        jobType: JobType,
        status: JobStatus,
    ): StoryGenerationJob?

    /**
     * 한 storyId 의 특정 jobType 작업 중, 주어진 status 목록에 속하는
     * 가장 최근 작업을 조회.
     *
     * 줄거리 재생성 요청 시 "이미 진행 중인(QUEUED/RUNNING) 또는
     * 직전 SUCCESS 잡" 을 한 번에 찾아 분기 처리하기 위함.
     */
    fun findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
        storyId: Long,
        jobType: JobType,
        statuses: List<JobStatus>,
    ): StoryGenerationJob?

    /**
     * 한 storyId 의 특정 jobType 작업 중 가장 최근 작업을 status 무관 1건 조회.
     *
     * `GET /summary` 응답을 만들 때 사용 — 최신 잡 1건의 status 만 보고
     * (PENDING/RUNNING/SUCCESS/FAILED) 화면 분기를 결정한다.
     */
    fun findFirstByStoryIdAndJobTypeOrderByIdDesc(
        storyId: Long,
        jobType: JobType,
    ): StoryGenerationJob?

    /**
     * 한 storyId 의 특정 jobType + status 조합에서 id 가 주어진 임계값보다 큰 잡 개수.
     *
     * "마지막 SUCCESS 이후 FAILED 개수" 카운트에 사용. lastSuccessJobId 가 없으면 0 을 넣어
     * 모든 FAILED 를 카운트, 있으면 그 id 보다 큰 FAILED 만 카운트.
     */
    fun countByStoryIdAndJobTypeAndStatusAndIdGreaterThan(
        storyId: Long,
        jobType: JobType,
        status: JobStatus,
        id: Long,
    ): Long

    fun countBySceneIdAndJobTypeAndStatusIn(
        sceneId: Long,
        jobType: JobType,
        statuses: List<JobStatus>,
    ): Long

    fun countByStoryIdAndJobTypeAndStatusIn(
        storyId: Long,
        jobType: JobType,
        statuses: List<JobStatus>,
    ): Long
}
