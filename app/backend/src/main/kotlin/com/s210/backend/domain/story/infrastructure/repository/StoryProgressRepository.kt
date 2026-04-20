package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.StoryProgress
import org.springframework.data.jpa.repository.JpaRepository

interface StoryProgressRepository : JpaRepository<StoryProgress, Long>
