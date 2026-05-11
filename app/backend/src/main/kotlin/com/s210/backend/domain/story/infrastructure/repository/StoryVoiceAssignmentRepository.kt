package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.StoryVoiceAssignment
import org.springframework.data.jpa.repository.JpaRepository

interface StoryVoiceAssignmentRepository : JpaRepository<StoryVoiceAssignment, Long> {
    fun findAllByStoryIdOrderBySpeakerKeyAsc(storyId: Long): List<StoryVoiceAssignment>

    fun deleteAllByStoryId(storyId: Long)
}
