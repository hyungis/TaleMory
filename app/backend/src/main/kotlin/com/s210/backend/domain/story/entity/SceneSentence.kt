package com.s210.backend.domain.story.entity

import com.s210.backend.common.entity.BaseTimeEntity
import jakarta.persistence.*

@Entity
@Table(name = "scene_sentences")
class SceneSentence(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "scene_id", nullable = false)
    val sceneId: Long,

    @Column(name = "sentence_order", nullable = false)
    val sentenceOrder: Int,

    @Column(name = "english_text", nullable = false, columnDefinition = "TEXT")
    var englishText: String,

    @Column(name = "korean_text", columnDefinition = "TEXT")
    var koreanText: String? = null,

    @Column(name = "tts_audio_url", length = 500)
    var ttsAudioUrl: String? = null,

    @Column(name = "speaker_key", length = 50)
    var speakerKey: String? = null,

    @Column(name = "has_highlighted", nullable = false)
    var hasHighlighted: Boolean = false
) : BaseTimeEntity()
