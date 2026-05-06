package com.s210.backend.domain.storyboard.presentation.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/**
 * `POST /api/stories/{storyId}/storyboard/pages/{pageNumber}/image/regenerate` 요청 body.
 *
 * 유저가 페이지 이미지를 다시 그리고 싶을 때 입력하는 자유 텍스트.
 * - AI 측 `userPrompt` 필드와 매칭 (1..2000자, NotBlank).
 * - additionalInstruction 으로 합쳐 Gemini 한테 전달됨.
 */
data class RegenerateStoryboardImageRequest(
    @field:NotBlank(message = "userPrompt 는 비어있을 수 없습니다.")
    @field:Size(max = 2000, message = "userPrompt 는 최대 2000자까지 입력 가능합니다.")
    val userPrompt: String,
)
