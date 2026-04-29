package com.s210.backend.common.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.reactive.ReactorClientHttpConnector
import org.springframework.web.reactive.function.client.WebClient
import reactor.netty.http.client.HttpClient
import java.time.Duration

@Configuration
class WebClientConfig(
    @Value("\${ai.service.base-url}") private val aiBaseUrl: String,
) {
    @Bean
    fun aiServiceWebClient(): WebClient {
        val http = HttpClient.create().responseTimeout(Duration.ofSeconds(30))
        return WebClient.builder()
            .baseUrl(aiBaseUrl)
            .clientConnector(ReactorClientHttpConnector(http))
            .build()
    }
}
