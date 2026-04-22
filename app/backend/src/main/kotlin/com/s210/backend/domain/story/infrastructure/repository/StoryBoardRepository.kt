package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.StoryBoard
import org.springframework.data.jpa.repository.JpaRepository

interface StoryBoardRepository : JpaRepository<StoryBoard, Long>
