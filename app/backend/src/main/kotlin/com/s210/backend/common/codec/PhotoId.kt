package com.s210.backend.common.codec

import org.springframework.core.convert.converter.Converter
import org.springframework.stereotype.Component

/**
 * 동화 제작 사진 (Step 2 업로드) 식별자.
 * `/api/stories/{storyId}/photos/{photoId}/...` 경로 + 응답 DTO 노출용.
 */
data class PhotoId(val value: Long) {
    override fun toString(): String = value.toString()
}

@Component
class PhotoIdPathConverter(private val idCodec: IdCodec) : Converter<String, PhotoId> {
    override fun convert(source: String): PhotoId = PhotoId(idCodec.decode(source))
}

class PhotoIdJsonSerializer : EntityIdJsonSerializer<PhotoId>(PhotoId::value)
class PhotoIdJsonDeserializer : EntityIdJsonDeserializer<PhotoId>(PhotoId::class.java, ::PhotoId)
