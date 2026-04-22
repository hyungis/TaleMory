package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.Scene
import org.springframework.data.jpa.repository.JpaRepository

interface SceneRepository : JpaRepository<Scene, Long> {
    fun findByStoryIdOrderByPageNumberAsc(storyId: Long): List<Scene>
}
