package com.s210.backend.common.codec

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import tools.jackson.databind.JacksonModule

/**
 * Spring Boot 의 default ObjectMapper 빌더에 IdCodec 관련 Jackson 모듈을 주입.
 *
 * `JacksonModule` (Jackson 3, `tools.jackson`) 타입 빈은 Boot 의 `JsonMapper.Builder` 자동 구성에서
 * 자동으로 register 된다. 별도 `Jackson2ObjectMapperBuilderCustomizer` 는 필요 없음.
 */
@Configuration
class IdCodecJacksonConfig {

    @Bean
    fun storyIdJacksonModule(): JacksonModule = StoryIdJacksonModule()
}
