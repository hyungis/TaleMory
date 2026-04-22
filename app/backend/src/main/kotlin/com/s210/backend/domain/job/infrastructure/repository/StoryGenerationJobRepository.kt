package com.s210.backend.domain.job.infrastructure.repository

import com.s210.backend.domain.job.entity.StoryGenerationJob
import org.springframework.data.jpa.repository.JpaRepository

interface StoryGenerationJobRepository : JpaRepository<StoryGenerationJob, Long>
