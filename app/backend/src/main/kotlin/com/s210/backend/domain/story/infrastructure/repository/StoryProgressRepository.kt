package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.StoryProgress
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface StoryProgressRepository : JpaRepository<StoryProgress, Long> {
    fun findByUserIdAndStoryId(userId: Long, storyId: Long): StoryProgress?

    @Modifying
    @Query("DELETE FROM StoryProgress p WHERE p.userId = :userId AND p.storyId = :storyId")
    fun deleteByUserAndStory(userId: Long, storyId: Long): Int
}
