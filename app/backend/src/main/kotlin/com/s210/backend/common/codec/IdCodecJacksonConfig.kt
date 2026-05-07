package com.s210.backend.common.codec

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import tools.jackson.databind.JacksonModule
import tools.jackson.databind.module.SimpleModule

/**
 * Spring Boot 의 default ObjectMapper 빌더에 IdCodec 관련 Jackson 모듈을 주입.
 *
 * `JacksonModule` (Jackson 3, `tools.jackson`) 타입 빈은 Boot 의 `JsonMapper.Builder` 자동 구성에서
 * 자동으로 register 된다. 별도 `Jackson2ObjectMapperBuilderCustomizer` 는 필요 없음.
 *
 * 새 도메인 ID 타입을 추가할 때:
 *  1. `common/codec/{Xxx}Id.kt` 에 데이터 클래스 + Spring Converter + Serializer/Deserializer 작성.
 *  2. 아래 `entityIdsJacksonModule()` 의 `addSerializer` / `addDeserializer` 한 쌍 추가.
 *  3. (선택) DTO/컨트롤러를 새 타입으로 마이그레이션.
 */
@Configuration
class IdCodecJacksonConfig {

    @Bean
    fun entityIdsJacksonModule(): JacksonModule = SimpleModule("EntityIdsJacksonModule").apply {
        addSerializer(StoryId::class.java, StoryIdJsonSerializer())
        addDeserializer(StoryId::class.java, StoryIdJsonDeserializer())

        addSerializer(JobId::class.java, JobIdJsonSerializer())
        addDeserializer(JobId::class.java, JobIdJsonDeserializer())

        addSerializer(SceneId::class.java, SceneIdJsonSerializer())
        addDeserializer(SceneId::class.java, SceneIdJsonDeserializer())

        addSerializer(SentenceId::class.java, SentenceIdJsonSerializer())
        addDeserializer(SentenceId::class.java, SentenceIdJsonDeserializer())

        addSerializer(PhotoId::class.java, PhotoIdJsonSerializer())
        addDeserializer(PhotoId::class.java, PhotoIdJsonDeserializer())

        addSerializer(VoiceProfileId::class.java, VoiceProfileIdJsonSerializer())
        addDeserializer(VoiceProfileId::class.java, VoiceProfileIdJsonDeserializer())

        addSerializer(PersonId::class.java, PersonIdJsonSerializer())
        addDeserializer(PersonId::class.java, PersonIdJsonDeserializer())
    }
}
