package com.s210.backend.common.codec

import org.springframework.core.convert.converter.Converter
import org.springframework.stereotype.Component

/**
 * 동화 식별자.
 *
 * 외부 (HTTP path / 응답 body) 에선 IdCodec 가 발행한 alphanumeric 토큰으로 노출되고,
 * 내부 (서비스 / 영속성 / 메시지) 에선 underlying [value] (Long) 로 다룬다.
 *
 * NOTE: `@JvmInline value class` 는 Spring `@PathVariable` 바인딩 / Jackson reflection 과 호환성
 * 이슈가 있어 일반 `data class` 로 둔다. 단일 Long field 라 메모리 오버헤드는 무시 가능 수준.
 */
data class StoryId(val value: Long) {
    override fun toString(): String = value.toString()
}

/**
 * Spring Boot 가 자동 등록하는 `Converter<String, StoryId>` — `@PathVariable` 으로 들어오는
 * String 을 StoryId 로 변환한다. raw BIGINT / 토큰 둘 다 허용 (IdCodec.decode 의 fallback 정책).
 */
@Component
class StoryIdPathConverter(private val idCodec: IdCodec) : Converter<String, StoryId> {
    override fun convert(source: String): StoryId = StoryId(idCodec.decode(source))
}

class StoryIdJsonSerializer : EntityIdJsonSerializer<StoryId>(StoryId::value)
class StoryIdJsonDeserializer : EntityIdJsonDeserializer<StoryId>(StoryId::class.java, ::StoryId)
