package com.s210.backend.common.config

import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.servers.Server
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class OpenApiConfig {

    @Bean
    fun openAPI(): OpenAPI = OpenAPI()
        .info(
            Info()
                .title("S14P31S210 Backend API")
                .description("영어 동화 학습 서비스 - 뷰어(Read-only) 우선 구현")
                .version("v1")
        )
        .addServersItem(Server().url("/").description("Default"))
}
