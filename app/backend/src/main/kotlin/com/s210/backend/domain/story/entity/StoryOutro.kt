package com.s210.backend.domain.story.entity

import com.s210.backend.common.entity.SoftDeletableEntity
import jakarta.persistence.*

@Entity
@Table(name = "story_outros")
class StoryOutro(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "story_id", nullable = false, unique = true)
    val storyId: Long,

    @Column(name = "outro_text", nullable = false, columnDefinition = "TEXT")
    var outroText: String,

    @Column(name = "audio_url", length = 500)
    var audioUrl: String? = null,

    @Column(length = 100)
    var signature: String? = null
) : SoftDeletableEntity()
