package com.s210.backend.domain.story.model

/**
 * 정규화된 좌표 (0~1) — 이미지 전체에 대한 비율로 표현되는 anchor 점.
 *
 * 사용처:
 *   - SceneSentence.bubbleSlot (WEBTOON 모드 한정. 말풍선/캡션의 표시 위치).
 *     · NARRATION 문장: 백엔드가 (0.5, 0.05) 로 고정 주입 — top center.
 *     · DIALOGUE 문장: AI Vision 이 추출한 캐릭터 머리 위 anchor 좌표.
 *
 * VIEWER 모드 row 는 항상 null 로 유지된다.
 *
 * 영속화 형식: JSON `{"x": 0~1, "y": 0~1}` (scene_sentences.bubble_slot 컬럼).
 * 애플리케이션 레이어에서 ObjectMapper 로 직렬화/역직렬화.
 */
data class AnchorPoint(
    val x: Double,
    val y: Double,
) {
    init {
        require(x in 0.0..1.0) { "AnchorPoint.x must be in 0..1, got $x" }
        require(y in 0.0..1.0) { "AnchorPoint.y must be in 0..1, got $y" }
    }

    companion object {
        /** NARRATION 기본 위치 — top center. */
        val NARRATION_DEFAULT = AnchorPoint(x = 0.5, y = 0.05)
    }
}
