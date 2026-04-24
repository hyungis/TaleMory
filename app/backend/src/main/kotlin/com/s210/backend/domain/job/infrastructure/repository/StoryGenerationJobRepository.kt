package com.s210.backend.domain.job.infrastructure.repository

import com.s210.backend.domain.job.entity.StoryGenerationJob
import org.springframework.data.jpa.repository.JpaRepository

interface StoryGenerationJobRepository : JpaRepository<StoryGenerationJob, Long> {
    /**
     * MQ 응답에 실린 jobId(UUID) 로 Job 조회.
     * AI 워커가 응답 envelope 에 external_id 를 그대로 실어주므로,
     * 결과 Listener 가 이 메서드로 대상 Job 을 찾아 상태 전이한다.
     */
    fun findByExternalId(externalId: String): StoryGenerationJob?
}
