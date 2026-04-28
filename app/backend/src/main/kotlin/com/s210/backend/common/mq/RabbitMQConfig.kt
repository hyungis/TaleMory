package com.s210.backend.common.mq

import org.springframework.amqp.core.Binding
import org.springframework.amqp.core.BindingBuilder
import org.springframework.amqp.core.Queue
import org.springframework.amqp.core.TopicExchange
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory
import org.springframework.amqp.rabbit.connection.ConnectionFactory
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter
import org.springframework.amqp.support.converter.MessageConverter
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * AI 서비스 (스토리 / 일러스트 / TTS 등) 와의 RabbitMQ 통신 토폴로지.
 *
 * 설계 원칙:
 *  - Exchange 는 방향별로 분리 (request / result) — Spring 이 자기 응답을 다시 consume 하지 않도록.
 *  - 요청 큐(CPU/GPU/IMAGE) 는 AI 워커가 (jobType, action) 별로 자체 declare/bind 한다.
 *    BE 는 라우팅 키만 알고 publish 만 신경쓰면 된다 (IMAGE 와 동일한 패턴).
 *  - 결과 큐(`ai.result.queue`) 만 BE 가 consume 하므로 여기서 declare 한다.
 *  - Routing key 규약: "ai.{hardware}.{jobType}.{action}"  (예: ai.cpu.story.generate)
 *  - Queue 명명 규약: "ai.{hardware}.{jobType}.{action}.request.queue"
 *    → routing key 와 큐 이름이 거울 대응 → 디버그 용이.
 */
@Configuration
class RabbitMQConfig {

    companion object {
        // ---------- Exchange ----------
        const val REQUEST_EXCHANGE = "ai.request"   // Spring → AI
        const val RESULT_EXCHANGE = "ai.result"     // AI → Spring

        // ---------- Queue ----------
        // 요청 큐는 AI 워커가 owner — 여기서 declare 하지 않는다.
        const val RESULT_QUEUE = "ai.result.queue"

        // ---------- Binding 패턴 ----------
        // 결과 envelope 만 BE 가 구독한다. (`ai.result.story.*`, `ai.result.image.*`, `ai.result.tts.*` 모두 매칭)
        private const val RESULT_PATTERN = "ai.result.#"
    }

    // =====================================================================
    // Exchange
    // =====================================================================

    @Bean
    fun requestExchange(): TopicExchange =
        TopicExchange(REQUEST_EXCHANGE, /* durable = */ true, /* autoDelete = */ false)

    @Bean
    fun resultExchange(): TopicExchange =
        TopicExchange(RESULT_EXCHANGE, true, false)

    // =====================================================================
    // Queue  (durable = true : RabbitMQ 재시작해도 큐 유지, 메시지 유실 방지)
    //  - BE 가 consume 하는 결과 큐만 여기서 declare.
    //  - 요청 큐들(`ai.cpu.story.*.request.queue`, `ai.image.*.request.queue` 등)은
    //    AI 워커(`app/ai/app/mq/client.py`)가 env 기반으로 declare/bind 한다.
    // =====================================================================

    @Bean
    fun resultQueue(): Queue = Queue(RESULT_QUEUE, true)

    // =====================================================================
    // Binding  (같은 타입 빈 다수이므로 @Qualifier 로 명시)
    // =====================================================================

    @Bean
    fun resultBinding(
        @Qualifier("resultQueue") queue: Queue,
        @Qualifier("resultExchange") exchange: TopicExchange,
    ): Binding = BindingBuilder.bind(queue).to(exchange).with(RESULT_PATTERN)

    // =====================================================================
    // Message Converter
    //  - AI 팀은 pydantic camelCase JSON 으로 직렬화하므로 Jackson 으로 맞춘다.
    //  - Spring Boot 4 + Jackson 3 기준: JacksonJsonMessageConverter (이름에 '2' 없음) 사용.
    //    (Jackson 2 용 Jackson2JsonMessageConverter 는 com.fasterxml.jackson.* 를 요구하지만
    //     이 프로젝트는 tools.jackson.* 만 포함.)
    //  - no-arg 생성자로 기본 JsonMapper 를 만들고, classpath 의 jackson-module-kotlin 은
    //    자동 감지되어 Kotlin data class 역직렬화가 OK.
    // =====================================================================

    @Bean
    fun jacksonJsonMessageConverter(): MessageConverter =
        JacksonJsonMessageConverter()

    // =====================================================================
    // Publisher 용 RabbitTemplate
    //  - Spring Boot 기본 템플릿은 SimpleMessageConverter (Java 직렬화) 라서
    //    반드시 JSON converter 로 교체해야 AI 팀과 호환된다.
    // =====================================================================

    @Bean
    fun rabbitTemplate(
        connectionFactory: ConnectionFactory,
        messageConverter: MessageConverter,
    ): RabbitTemplate = RabbitTemplate(connectionFactory).apply {
        setMessageConverter(messageConverter)
    }

    // =====================================================================
    // Consumer 용 ListenerContainerFactory
    //  - @RabbitListener 가 이 이름("rabbitListenerContainerFactory") 의 빈을 기본 사용.
    //  - JSON converter 를 여기에도 연결해서 envelope → Kotlin DTO 역직렬화 자동화.
    // =====================================================================

    @Bean
    fun rabbitListenerContainerFactory(
        connectionFactory: ConnectionFactory,
        messageConverter: MessageConverter,
    ): SimpleRabbitListenerContainerFactory = SimpleRabbitListenerContainerFactory().apply {
        setConnectionFactory(connectionFactory)
        setMessageConverter(messageConverter)
    }
}
