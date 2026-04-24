package com.s210.backend.domain.story.entity

import jakarta.persistence.*
import java.time.LocalDate

@Entity
@Table(name = "story_board")
class StoryBoard(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "story_id", nullable = false)
    val storyId: Long,

    @Column(nullable = false, length = 255)
    var prompt: String,

    @Column(nullable = false, columnDefinition = "TEXT")
    var story: String,

    @Column(name = "create_at", nullable = false)
    val createAt: LocalDate,

    @Column(name = "update_at")
    var updateAt: LocalDate? = null,

    @Column(name = "deleted_at")
    var deletedAt: LocalDate? = null
)
