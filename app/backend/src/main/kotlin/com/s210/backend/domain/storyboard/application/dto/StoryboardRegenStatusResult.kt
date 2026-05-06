package com.s210.backend.domain.storyboard.application.dto

/**
 * `GET /api/stories/{storyId}/storyboard/regen-status` 응답.
 *
 * Step 4 헤더 우측 재생성 카운터 표시용. 모든 페이지 합산이 아니라 **스토리(동화) 단위**
 * 카운트 — 한 동화당 N 회 한도 정책과 일치.
 *
 * - `used`: 지금까지 사용한 재생성 횟수 (SUCCESS + FAILED 합산).
 * - `limit`: 정책 상수 (`StoryboardImageRegenPolicy.LIMIT_PER_STORY`).
 * - `remaining`: limit - used. 음수가 되지 않도록 0 으로 clamp.
 */
data class StoryboardRegenStatusResult(
    val storyId: Long,
    val used: Int,
    val limit: Int,
    val remaining: Int,
)
