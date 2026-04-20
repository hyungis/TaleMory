package com.s210.backend.domain.story.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "story_progress")
class StoryProgress(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "story_id", nullable = false)
    val storyId: Long,

    @Column(name = "last_scene_page", nullable = false)
    var lastScenePage: Int = 1,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
)
