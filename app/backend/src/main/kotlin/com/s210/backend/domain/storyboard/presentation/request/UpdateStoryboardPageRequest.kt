package com.s210.backend.domain.storyboard.presentation.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/**
 * `PATCH /api/stories/{storyId}/storyboard/pages/{pageNumber}` 요청 body.
 *
 * Step 4 의 페이지별 textarea onBlur 시점에 호출된다.
 * - 한 페이지의 한글 본문(koreanText)만 수정. 영문본/sceneSummary/imagePrompt 는 AI 원본 보존.
 * - 빈 문자열 / 공백만 입력은 차단 (NotBlank).
 * - 한 페이지 koreanText 길이 상한 4000자.
 */
data class UpdateStoryboardPageRequest(
    @field:NotBlank(message = "koreanText 는 비어있을 수 없습니다.")
    @field:Size(max = 4000, message = "koreanText 는 최대 4000자까지 입력 가능합니다.")
    val koreanText: String,
)
