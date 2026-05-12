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
    const val STORY_REGENERATE = "ai.cpu.story.regenerate"

    // ---------- 스토리보드 이미지 생성 ----------
    // AI 팀 스펙은 hardware prefix 를 생략하고 `ai.image.*` 로 통일했다.
    // 워커가 자체적으로 큐(`ai.image.generate.request.queue`)를 declare/bind 하므로
    // BE 는 publish 만 신경쓰면 된다.
    const val IMAGE_GENERATE = "ai.image.generate"
    const val IMAGE_REGENERATE = "ai.image.regenerate"

    // ---------- 최종(컬러) 일러스트 생성 ----------
    // AI 팀 큐 prefix 와 일치 (RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ROUTING_KEY).
    // 워커가 자체적으로 큐(`ai.final-illustration.generate.request.queue`)를 declare/bind.
    const val FINAL_ILLUSTRATION_GENERATE = "ai.image.final-illustration.generate"
    const val FINAL_ILLUSTRATION_REVISE = "ai.image.final-illustration.revise"

    // ---------- WEBTOON 모드 — 최종 삽화 좌표 추출 ----------
    // AI 워커가 Gemini Vision 으로 캐릭터 머리 위 anchor 좌표를 추출해서 ai.result 로 페이지별 publish.
    //  - LAYOUT       : 동화 단위 batch 진입점 (페이지 N장 한 번에 fan-out 요청).
    //  - LAYOUT_ITEM  : 부분 실패 또는 사용자 수동 재시도용 단건 큐.
    // AI 워커 env: RABBITMQ_FINAL_ILLUSTRATION_LAYOUT_ROUTING_KEY / *_ITEM_ROUTING_KEY.
    const val FINAL_ILLUSTRATION_LAYOUT = "ai.image.final-illustration.layout"
    const val FINAL_ILLUSTRATION_LAYOUT_ITEM = "ai.image.final-illustration.layout.item"

    // ---------- 스토리(동화) 줄거리(요약) 생성 ----------
    const val STORY_SUMMARY_GENERATE = "ai.cpu.story.summary.generate"
    const val STORY_SUMMARY_REGENERATE = "ai.cpu.story.summary.regenerate"
    const val STORY_SENTENCE_TRANSLATE = "ai.cpu.story.sentences.translate"

    // ---------- TTS 생성 ----------
    // 워커가 자체적으로 큐(`ai.gpu.request.queue` 또는 `ai.gpu.tts.generate.request.queue`)를
    // declare/bind 하므로 BE 는 publish 만 신경쓰면 된다.
    const val TTS_GENERATE = "ai.gpu.tts.generate"

    // ---------- TTS 미리듣기 ----------
    const val TTS_PREVIEW = "ai.gpu.tts.preview"
}
