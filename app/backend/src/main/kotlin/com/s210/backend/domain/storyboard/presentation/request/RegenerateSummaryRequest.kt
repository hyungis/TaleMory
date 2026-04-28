package com.s210.backend.domain.storyboard.presentation.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/**
 * `POST /api/stories/{storyId}/storyboard/summary/regenerate` 요청 body.
 *
 * 줄거리(요약) 재생성 시 사용자가 입력하는 자유 텍스트.
 * - AI 측 `userPrompt` 필드와 매칭 (NotBlank).
 * - 직전 SUCCESS 줄거리의 payload 와 함께 AI 에 전달되어 변형/보강 베이스로 쓰인다.
 */
data class RegenerateSummaryRequest(
    @field:NotBlank(message = "userPrompt 는 비어있을 수 없습니다.")
    @field:Size(max = 2000, message = "userPrompt 는 최대 2000자까지 입력 가능합니다.")
    val userPrompt: String,
)
