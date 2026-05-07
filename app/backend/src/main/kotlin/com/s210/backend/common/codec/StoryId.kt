package com.s210.backend.common.codec

import org.springframework.core.convert.converter.Converter
import org.springframework.stereotype.Component
import tools.jackson.core.JsonGenerator
import tools.jackson.core.JsonParser
import tools.jackson.databind.DeserializationContext
import tools.jackson.databind.SerializationContext
import tools.jackson.databind.ValueDeserializer
import tools.jackson.databind.ValueSerializer
import tools.jackson.databind.module.SimpleModule

/**
 * 동화 식별자.
 *
 * 외부 (HTTP path / 응답 body) 에선 IdCodec 가 발행한 alphanumeric 토큰으로 노출되고,
 * 내부 (서비스 / 영속성 / 메시지) 에선 underlying [value] (Long) 로 다룬다.
 *
 * Phase 1 도입 — 처음에는 Story 만 적용. 이후 SceneId / JobId / PhotoId 등도 같은 패턴으로 추가.
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

/** Jackson 응답 직렬화 — StoryId -> 토큰 문자열. */
class StoryIdJsonSerializer : ValueSerializer<StoryId>() {
    override fun serialize(value: StoryId, gen: JsonGenerator, ctxt: SerializationContext) {
        gen.writeString(IdCodec.instance.encode(value.value))
    }
}

/** Jackson 요청/응답 역직렬화 — 토큰/raw BIGINT 문자열 또는 number -> StoryId. */
class StoryIdJsonDeserializer : ValueDeserializer<StoryId>() {
    override fun deserialize(p: JsonParser, ctxt: DeserializationContext): StoryId {
        // number 가 그대로 들어오는 케이스도 허용 (legacy 클라이언트 호환).
        if (p.currentToken().isNumeric) {
            return StoryId(p.longValue)
        }
        val token = p.valueAsString
            ?: throw ctxt.weirdStringException(p.text, StoryId::class.java, "expected token string")
        return StoryId(IdCodec.instance.decode(token))
    }
}

/**
 * Jackson 3 (`tools.jackson`) 모듈 — StoryId 직렬화/역직렬화 등록.
 * `IdCodecJacksonConfig` 에서 `@Bean` 으로 노출하면 Spring Boot 가 default ObjectMapper 에 자동 적용.
 */
class StoryIdJacksonModule : SimpleModule("StoryIdModule") {
    init {
        addSerializer(StoryId::class.java, StoryIdJsonSerializer())
        addDeserializer(StoryId::class.java, StoryIdJsonDeserializer())
    }
}
