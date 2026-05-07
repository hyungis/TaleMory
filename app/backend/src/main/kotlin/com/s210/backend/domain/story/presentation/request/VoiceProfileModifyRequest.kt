package com.s210.backend.domain.story.presentation.request

import com.s210.backend.common.codec.VoiceProfileId

data class VoiceProfileModifyRequest(
    val voiceProfileId: VoiceProfileId,
)
