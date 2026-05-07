package com.s210.backend.common.codec

import org.springframework.core.convert.converter.Converter
import org.springframework.stereotype.Component

/**
 * 사용자 보이스 프로필 (CosyVoice 클로닝 음원) 식별자.
 * `/api/voice-profiles/{voiceProfileId}` 경로 + Story 의 voiceProfileId 참조 노출용.
 */
data class VoiceProfileId(val value: Long) {
    override fun toString(): String = value.toString()
}

@Component
class VoiceProfileIdPathConverter(private val idCodec: IdCodec) : Converter<String, VoiceProfileId> {
    override fun convert(source: String): VoiceProfileId = VoiceProfileId(idCodec.decode(source))
}

class VoiceProfileIdJsonSerializer : EntityIdJsonSerializer<VoiceProfileId>(VoiceProfileId::value)
class VoiceProfileIdJsonDeserializer :
    EntityIdJsonDeserializer<VoiceProfileId>(VoiceProfileId::class.java, ::VoiceProfileId)
