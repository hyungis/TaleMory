package com.s210.backend.domain.story.model

/**
 * 정규화된 좌표 (0~1) — 이미지 전체에 대한 비율로 표현되는 anchor 점.
 *
 * 사용처: WEBTOON 모드 layout 메시지 DTO 의 캐릭터 anchor 점 표현용.
 * 페이지 단위 캐릭터 좌표는 `scene.character_anchors` JSON 배열 (CharacterAnchorView)
 * 로 영속화되며, FE 가 sentence.speakerKey 로 lookup 해서 말풍선 위치를 결정한다.
 * NARRATION (speakerKey 없음) 은 FE 측 fallback (top center) 으로 처리.
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
