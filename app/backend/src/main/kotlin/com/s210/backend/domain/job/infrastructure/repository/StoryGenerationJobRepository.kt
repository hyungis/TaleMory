package com.s210.backend.domain.job.infrastructure.repository

import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import org.springframework.data.jpa.repository.JpaRepository

interface StoryGenerationJobRepository : JpaRepository<StoryGenerationJob, Long> {

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
}
