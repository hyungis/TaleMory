package com.s210.backend.common.codec

import org.springframework.core.convert.converter.Converter
import org.springframework.stereotype.Component

/**
 * 동화책 씬의 한 문장 식별자.
 * 강조 녹음 / 뷰어 응답 등에서 외부 노출.
 */
data class SentenceId(val value: Long) {
    override fun toString(): String = value.toString()
}

@Component
class SentenceIdPathConverter(private val idCodec: IdCodec) : Converter<String, SentenceId> {
    override fun convert(source: String): SentenceId = SentenceId(idCodec.decode(source))
}

class SentenceIdJsonSerializer : EntityIdJsonSerializer<SentenceId>(SentenceId::value)
class SentenceIdJsonDeserializer : EntityIdJsonDeserializer<SentenceId>(SentenceId::class.java, ::SentenceId)
