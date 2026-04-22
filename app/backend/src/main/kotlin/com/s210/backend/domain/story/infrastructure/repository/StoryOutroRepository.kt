package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.StoryOutro
import org.springframework.data.jpa.repository.JpaRepository

interface StoryOutroRepository : JpaRepository<StoryOutro, Long>
