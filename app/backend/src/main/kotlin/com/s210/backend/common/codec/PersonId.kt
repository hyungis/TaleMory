package com.s210.backend.common.codec

import org.springframework.core.convert.converter.Converter
import org.springframework.stereotype.Component

/**
 * 인물(아이/동행자) 프로필 식별자.
 * `/api/persons/{personId}` 경로 + 응답 DTO 노출용.
 */
data class PersonId(val value: Long) {
    override fun toString(): String = value.toString()
}

@Component
class PersonIdPathConverter(private val idCodec: IdCodec) : Converter<String, PersonId> {
    override fun convert(source: String): PersonId = PersonId(idCodec.decode(source))
}

class PersonIdJsonSerializer : EntityIdJsonSerializer<PersonId>(PersonId::value)
class PersonIdJsonDeserializer : EntityIdJsonDeserializer<PersonId>(PersonId::class.java, ::PersonId)
