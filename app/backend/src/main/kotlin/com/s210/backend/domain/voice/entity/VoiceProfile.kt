package com.s210.backend.domain.voice.entity

import com.s210.backend.common.entity.SoftDeletableEntity
import jakarta.persistence.*

@Entity
@Table(name = "voice_profiles")
class VoiceProfile(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(nullable = false, length = 100)
    var title: String,

    @Column(name = "audio_url", length = 500)
    var audioUrl: String? = null,

    @Column(name = "tts_voice_url", length = 500)
    var ttsVoiceUrl: String? = null
) : SoftDeletableEntity()
