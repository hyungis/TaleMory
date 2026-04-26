package com.s210.backend.common.mq

/**
 * AI MQ publish 시 사용하는 라우팅 키 상수 모음.
 *
 * 규약: "ai.{hardware}.{jobType}.{action}"
 *   - hardware: cpu | gpu               — 필요 워커 능력
 *   - jobType:  story | illustration | tts | bgm | voice_clone 등
 *   - action:   generate | regenerate
 *
 * RabbitMQConfig 의 binding 패턴 ("ai.cpu.#" / "ai.gpu.#") 과 조합되어
 * 각 메시지가 올바른 큐로 자동 라우팅된다.
 *
 * 결과 라우팅 키 (ai.result.*) 는 AI 가 publish 하므로 Spring 은 구독 패턴만 관리한다.
 */
object RoutingKeys {
    // ---------- 스토리(동화 본문) 생성 ----------
    const val STORY_GENERATE = "ai.cpu.story.generate"

    // ---------- 스토리보드 이미지 생성 ----------
    // AI 팀 스펙은 hardware prefix 를 생략하고 `ai.image.*` 로 통일했다.
    // 워커가 자체적으로 큐(`ai.image.generate.request.queue`)를 declare/bind 하므로
    // BE 는 publish 만 신경쓰면 된다.
    const val IMAGE_GENERATE = "ai.image.generate"
    const val IMAGE_REGENERATE = "ai.image.regenerate"

    // ---------- 후속 이슈에서 추가 예정 ----------
    // const val STORY_REGENERATE = "ai.cpu.story.regenerate"
    // const val TTS_GENERATE = "ai.gpu.tts.generate"
}
