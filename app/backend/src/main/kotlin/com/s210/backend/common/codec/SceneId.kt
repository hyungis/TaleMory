package com.s210.backend.common.codec

import org.springframework.core.convert.converter.Converter
import org.springframework.stereotype.Component

/**
 * 동화책 한 페이지(씬) 식별자.
 * `/api/stories/{storyId}/scenes/{sceneId}/...` 경로 + 응답 DTO 노출용.
 */
data class SceneId(val value: Long) {
    override fun toString(): String = value.toString()
}

@Component
class SceneIdPathConverter(private val idCodec: IdCodec) : Converter<String, SceneId> {
    override fun convert(source: String): SceneId = SceneId(idCodec.decode(source))
}

class SceneIdJsonSerializer : EntityIdJsonSerializer<SceneId>(SceneId::value)
class SceneIdJsonDeserializer : EntityIdJsonDeserializer<SceneId>(SceneId::class.java, ::SceneId)
