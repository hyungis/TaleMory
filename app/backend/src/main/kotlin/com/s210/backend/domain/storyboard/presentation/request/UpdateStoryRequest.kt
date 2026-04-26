package com.s210.backend.domain.storyboard.presentation.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/**
 * `PATCH /api/stories/{storyId}/storyboard/story` 요청 body.
 * 유저가 Step 3 에서 편집한 synopsis 를 그대로 저장한다.
 *
 * NOTE: Notion 명세 #29 의 request 는 `prompt` 필드로 되어있지만,
 *       해당 필드는 "AI 재요청 프롬프트" 와 혼동되어 읽기 어렵다.
 *       여기서는 의미를 명확히 하기 위해 `story` 로 명명한다.
 *       (재요청은 별도 POST /storyboard/story 재호출로 처리)
 */
data class UpdateStoryRequest(
    @field:NotBlank(message = "story 는 비어있을 수 없습니다.")
    @field:Size(max = 4000, message = "story 는 최대 4000자까지 입력 가능합니다.")
    val story: String,
)
