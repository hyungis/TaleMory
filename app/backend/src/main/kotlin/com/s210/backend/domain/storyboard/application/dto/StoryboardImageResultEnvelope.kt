package com.s210.backend.domain.storyboard.application.dto

/**
 * 스토리보드 이미지 결과 envelope (AI → BE).
 *
 * AI 측 `app/ai/app/schemas/mq_storyboard_image.py` 의
 *  - `StoryboardImageSuccessEnvelope` (status=COMPLETED)
 *  - `StoryboardImageFailureEnvelope` (status=FAILED)
 * 를 한 Kotlin DTO 로 합쳤다 (payload / error 중 하나만 채워진다).
 *
 * type 예시:
 *  - "GENERATE_STORYBOARD_IMAGE_COMPLETED"  / "GENERATE_STORYBOARD_IMAGE_FAILED"
 *  - "REGENERATE_STORYBOARD_IMAGE_COMPLETED" / "REGENERATE_STORYBOARD_IMAGE_FAILED"
 *
 * 핵심:
 *  - 페이지 1장당 1개 메시지가 도착한다 (AI 워커가 fan-out).
 *  - `pageNumber` 로 어떤 페이지의 결과인지 식별.
 *  - `type` 의 prefix(GENERATE / REGENERATE)로 BE 잡 마무리 정책이 갈린다:
 *      GENERATE  → 모든 페이지 image_url 채워진 시점에 SUCCESS
 *      REGENERATE → 1장 도달 즉시 SUCCESS
 */
data class StoryboardImageResultEnvelope(
    val jobId: String,
    val type: String,
    val storyId: Long,
    val pageNumber: Int? = null,
    val status: String,
    val payload: StoryboardImageResultPayload? = null,
    val error: StoryboardImageResultError? = null,
)

/** 성공 envelope 의 payload — `seed` 와 한 페이지 결과를 포함. */
data class StoryboardImageResultPayload(
    val seed: Int,
    val result: StoryboardImageResultData,
)

/** 한 페이지 그림 결과. AI 가 S3 에 업로드한 public URL. */
data class StoryboardImageResultData(
    val pageNumber: Int,
    val imageUrl: String,
    /**
     * AI 측 usage 메타 (provider/model/tokens/cost 등).
     * 자세한 구조는 BE 가 직접 사용 안 하므로 raw Map 으로 보존.
     */
    val usage: Map<String, Any?>? = null,
)

/** 실패 envelope 의 error. AI 측 `StoryboardImageError` 와 1:1. */
data class StoryboardImageResultError(
    val code: String,
    val message: String,
)
