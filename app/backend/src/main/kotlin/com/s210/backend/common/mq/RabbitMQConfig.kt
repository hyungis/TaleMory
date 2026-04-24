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
 * AI 서비스 (스토리 / 장차 일러스트 / TTS 등) 와의 RabbitMQ 통신 토폴로지.
 *
 * 설계 원칙:
 *  - Exchange 는 방향별로 분리 (request / result) — Spring 이 자기 응답을 다시 consume 하지 않도록.
 *  - Queue 는 "워커 능력(하드웨어) 경계" 로만 분리. 같은 CPU 에서 처리 가능한 작업들은 한 큐에 모으고,
 *    AI 워커가 envelope 의 jobType + action 으로 분기 처리한다.
 *  - Routing key 규약: "ai.{hardware}.{jobType}.{action}"  (예: ai.cpu.story.generate)
 *
 * 지금은 CPU 요청 + 공용 결과 각 1개. 장차 TTS 등 GPU 워커 필요 시
 * ai.gpu.request.queue 와 해당 binding 만 @Bean 으로 추가하면 된다.
 */
@Configuration
class RabbitMQConfig {

    companion object {
        // ---------- Exchange ----------
        const val REQUEST_EXCHANGE = "ai.request"   // Spring → AI
        const val RESULT_EXCHANGE = "ai.result"     // AI → Spring

        // ---------- Queue ----------
        const val CPU_REQUEST_QUEUE = "ai.cpu.request.queue"
        const val RESULT_QUEUE = "ai.result.queue"

        // ---------- Binding 패턴 ----------
        private const val CPU_REQUEST_PATTERN = "ai.cpu.#"
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
    // =====================================================================

    @Bean
    fun cpuRequestQueue(): Queue = Queue(CPU_REQUEST_QUEUE, /* durable = */ true)

    @Bean
    fun resultQueue(): Queue = Queue(RESULT_QUEUE, true)

    // =====================================================================
    // Binding  (같은 타입 빈 다수이므로 @Qualifier 로 명시)
    // =====================================================================

    @Bean
    fun cpuRequestBinding(
        @Qualifier("cpuRequestQueue") queue: Queue,
        @Qualifier("requestExchange") exchange: TopicExchange,
    ): Binding = BindingBuilder.bind(queue).to(exchange).with(CPU_REQUEST_PATTERN)

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
