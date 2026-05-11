package com.s210.backend.domain.story.entity

import com.s210.backend.common.entity.BaseTimeEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "story_voice_assignments")
class StoryVoiceAssignment(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "story_id", nullable = false)
    val storyId: Long,

    @Column(name = "speaker_key", nullable = false, length = 50)
    val speakerKey: String,

    @Column(name = "speaker_name", length = 100)
    var speakerName: String? = null,

    @Column(name = "voice_profile_id", nullable = false)
    var voiceProfileId: Long,
) : BaseTimeEntity()
