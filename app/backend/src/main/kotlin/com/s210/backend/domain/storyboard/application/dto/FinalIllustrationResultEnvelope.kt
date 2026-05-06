package com.s210.backend.domain.storyboard.application.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/**
 * AI 가 publish 하는 최종 일러스트 결과 envelope.
 * AI 는 페이지별로 1개씩 publish 한다 (배치 분할 후).
 * BE 는 routing key `ai.result.final-illustration.generate.completed/failed` 로 받는다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class FinalIllustrationResultEnvelope(
    val jobId: String,
    val type: String,            // GENERATE_FINAL_ILLUSTRATION_COMPLETED / FAILED
    val storyId: Long,
    val pageNumber: Int? = null, // FAILED 일 땐 null 가능
    val status: String,          // COMPLETED / FAILED
    val payload: FinalIllustrationResultPayload? = null,
    val error: FinalIllustrationResultError? = null,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class FinalIllustrationResultPayload(
    val seed: Int,
    val result: FinalIllustrationResultData,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class FinalIllustrationResultData(
    val pageNumber: Int,
    val imageUrl: String,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class FinalIllustrationResultError(
    val code: String,
    val message: String,
)
