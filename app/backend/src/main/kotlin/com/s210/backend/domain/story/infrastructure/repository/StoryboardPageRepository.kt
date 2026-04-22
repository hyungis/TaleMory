package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.StoryboardPage
import org.springframework.data.jpa.repository.JpaRepository

interface StoryboardPageRepository : JpaRepository<StoryboardPage, Long>
