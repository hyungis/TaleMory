package com.s210.backend.domain.storyboard.application.dto

/**
 * Step 5 PATCH /style 직후 BE 가 AI 로 publish 하는 최종 일러스트 배치 생성 메시지.
 * AI 스키마: FinalIllustrationGenerateJobMessage / FinalIllustrationGenerateRequest.
 *
 * jobId 는 String — AI 측 min_length=1 검증 통과를 위해 Long.toString() 으로 직렬화.
 */
data class FinalIllustrationGenerateMessage(
    val jobId: String,
    val jobType: String = "FINAL_ILLUSTRATION",
    val storyId: Long,
    val payload: FinalIllustrationGeneratePayload,
)

data class FinalIllustrationGeneratePayload(
    val storyId: Long,
    val seed: Int,
    val renderOptions: FinalIllustrationRenderOptions = FinalIllustrationRenderOptions(),
    val items: List<FinalIllustrationItem>,
)

/** AI 측 기본값과 동일 — BE 는 모두 default 를 그대로 보낸다. */
data class FinalIllustrationRenderOptions(
    val aspectRatio: String = "match_input_image",
    val megapixels: String = "1",
    val outputFormat: String = "png",
    val outputQuality: Int = 95,
    val numOutputs: Int = 1,
    val goFast: Boolean = false,
    val safetyTolerance: Int = 2,
    val disableSafetyChecker: Boolean = false,
)

data class FinalIllustrationItem(
    val pageNumber: Int,
    val storyboard: FinalIllustrationContext,
    val page: FinalIllustrationPagePayload,
    val children: List<ChildInfo>,
    val companions: List<String>,
    /**
     * Step 4 에서 생성된 storyboard rough 의 URL.
     * AI 측 model_validator 가 (roughStoryboardImageUrl | roughStoryboardImageS3Key |
     * currentIllustrationImageS3Key) 중 하나는 필수.
     */
    val roughStoryboardImageUrl: String? = null,
    /** Step 4 rough 이미지 S3 key (URL 대신 사용 가능). */
    val roughStoryboardImageS3Key: String? = null,
    /** 기존 최종 일러스트 S3 key (수정/재생성 시 사용). */
    val currentIllustrationImageS3Key: String? = null,
    val stylePrompt: String,
    val additionalInstruction: String? = null,
)

data class FinalIllustrationContext(
    val title: String,
    val synopsis: String,
)

data class FinalIllustrationPagePayload(
    val pageNumber: Int,
    val sceneSummary: String,
    val englishText: String,
    val koreanText: String,
    val imagePrompt: String,
)
