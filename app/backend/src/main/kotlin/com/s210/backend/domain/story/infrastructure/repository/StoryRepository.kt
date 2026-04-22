package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.Story
import org.springframework.data.jpa.repository.JpaRepository

interface StoryRepository : JpaRepository<Story, Long>
