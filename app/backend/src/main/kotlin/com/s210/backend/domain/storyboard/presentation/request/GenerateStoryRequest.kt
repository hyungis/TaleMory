package com.s210.backend.domain.storyboard.presentation.request

/**
 * `POST /api/stories/{storyId}/storyboard/story` 의 요청 body.
 * API 명세 #28.
 *
 * prompt: 사용자가 Step 3 에서 작성한 자유 프롬프트. 선택 사항.
 *         AI 의 `additionalInstruction` 에 그대로 전달된다.
 */
data class GenerateStoryRequest(
    val prompt: String? = null,
)
