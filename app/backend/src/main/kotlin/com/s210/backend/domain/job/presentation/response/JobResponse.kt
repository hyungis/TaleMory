package com.s210.backend.domain.job.presentation.response

import tools.jackson.databind.JsonNode
import java.math.BigDecimal
import java.time.LocalDateTime

/**
 * `GET /api/generation-jobs/{jobId}` 의 응답 (API 명세 #56).
 * FE 의 polling 대상 — `resultPayload` 가 채워지면 SUCCESS, `errorMessage` 가 채워지면 FAILED.
 */
data class JobResponse(
    val jobId: Long,
    val storyId: Long,
    val sentenceId: Long?,
    val sceneId: Long?,
    val jobType: String,
    val status: String,
    /** AI 에 보낸 원 요청 JSON. DB 에 string 으로 저장돼 있어 JsonNode 로 파싱 후 중첩 노출. */
    val requestPayload: JsonNode?,
    /** AI 응답 JSON. 완료 전에는 null. */
    val resultPayload: JsonNode?,
    val errorMessage: String?,
    val costUsd: BigDecimal?,
    val startedAt: LocalDateTime?,
    val finishedAt: LocalDateTime?,
    val createdAt: LocalDateTime,
)

/**
 * 비동기 작업 시작 시 반환하는 간략 응답 (API 명세 공통 규약 `{ jobId, jobType, status }`).
 * 현재 StartGenerationResult 와 중복이라 실사용은 StartGenerationResult 로 통일.
 */
data class JobStartResponse(
    val jobId: Long,
    val jobType: String,
    val status: String,
)
