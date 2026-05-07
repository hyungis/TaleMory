package com.s210.backend.common.codec

import tools.jackson.core.JsonGenerator
import tools.jackson.core.JsonParser
import tools.jackson.databind.DeserializationContext
import tools.jackson.databind.SerializationContext
import tools.jackson.databind.ValueDeserializer
import tools.jackson.databind.ValueSerializer

/**
 * 도메인 ID 값 객체를 토큰 문자열로 직렬화하는 Jackson 3 ValueSerializer 의 공통 베이스.
 *
 * @param getValue ID 값 객체에서 underlying Long 을 꺼내는 함수.
 *
 * 사용 예:
 * ```
 * class StoryIdJsonSerializer : EntityIdJsonSerializer<StoryId>(StoryId::value)
 * ```
 *
 * IdCodec.instance 정적 핸들로 인코딩 — Jackson 이 직접 인스턴스화하므로 Spring DI 가 닿지 않음.
 */
abstract class EntityIdJsonSerializer<T : Any>(
    private val getValue: (T) -> Long,
) : ValueSerializer<T>() {
    override fun serialize(value: T, gen: JsonGenerator, ctxt: SerializationContext) {
        gen.writeString(IdCodec.instance.encode(getValue(value)))
    }
}

/**
 * 토큰 문자열 또는 raw BIGINT number/string 을 도메인 ID 값 객체로 역직렬화하는 공통 베이스.
 *
 * @param type 대상 타입의 Class — Jackson 의 weirdStringException 에 보고용.
 * @param constructor Long -> ID 값 객체 생성자.
 *
 * 허용 입력:
 *  - JSON number → 그대로 Long 으로 파싱 (legacy raw-id 호환).
 *  - JSON string  → IdCodec.decode (토큰 우선, raw BIGINT 문자열도 fallback 허용).
 */
abstract class EntityIdJsonDeserializer<T : Any>(
    private val type: Class<T>,
    private val constructor: (Long) -> T,
) : ValueDeserializer<T>() {
    override fun deserialize(p: JsonParser, ctxt: DeserializationContext): T {
        if (p.currentToken().isNumeric) {
            return constructor(p.longValue)
        }
        val token = p.valueAsString
            ?: throw ctxt.weirdStringException("<null>", type, "expected id token string")
        return constructor(IdCodec.instance.decode(token))
    }
}
