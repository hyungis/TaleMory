package com.s210.backend.common.codec

import org.springframework.core.convert.converter.Converter
import org.springframework.stereotype.Component

/**
 * AI 비동기 잡 (storyboard / image / tts / final-illustration) 식별자.
 * 외부 polling URL `GET /api/generation-jobs/{jobId}` 에 노출되므로 토큰화 대상.
 */
data class JobId(val value: Long) {
    override fun toString(): String = value.toString()
}

@Component
class JobIdPathConverter(private val idCodec: IdCodec) : Converter<String, JobId> {
    override fun convert(source: String): JobId = JobId(idCodec.decode(source))
}

class JobIdJsonSerializer : EntityIdJsonSerializer<JobId>(JobId::value)
class JobIdJsonDeserializer : EntityIdJsonDeserializer<JobId>(JobId::class.java, ::JobId)
