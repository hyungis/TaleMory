package com.s210.backend.domain.story.presentation.response

/**
 * PATCH /api/stories/{storyId}/style 응답.
 * jobId 는 Step 5 직후 백그라운드로 enqueue 된 FINAL_ILLUSTRATION 잡의 id (멱등 가드 시 기존 jobId).
 * FE 는 이 jobId 를 store 에 저장해두었다가 Step 8 에서 폴링한다.
 */
data class StyleModifyResponse(
    val finalIllustrationJobId: Long,
)
