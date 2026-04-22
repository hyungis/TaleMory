package com.s210.backend.domain.story.entity

import com.s210.backend.common.entity.SoftDeletableEntity
import jakarta.persistence.*

@Entity
@Table(name = "scene_highlight_voices")
class SceneHighlightVoice(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "sentence_id", nullable = false, unique = true)
    val sentenceId: Long,

    @Column(name = "audio_url", nullable = false, length = 500)
    var audioUrl: String
) : SoftDeletableEntity()
