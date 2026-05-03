package com.s210.backend.domain.storyboard.application.dto

/**
 * StoryGenerationJob.requestPayload 에 직렬화되어 들어가는 FINAL_ILLUSTRATION 잡 메타.
 * - stylePresetId: 멱등 가드가 같은 스타일 재요청을 감지할 수 있도록 별도 보관.
 * - payload: AI 로 publish 한 메시지 페이로드 그대로(디버깅/재현용).
 */
data class FinalIllustrationJobMeta(
    val stylePresetId: Long,
    val payload: FinalIllustrationGeneratePayload,
)
