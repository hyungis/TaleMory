package com.s210.backend.domain.storyboard.application.dto

/**
 * `POST /api/stories/{storyId}/storyboard/story` 의 202 Accepted 응답 payload.
 * API 명세 #28 (비동기 작업 공통 응답 포맷 `{ jobId, jobType, status }`).
 *
 * 실제 스토리 생성은 MQ 로 비동기 진행되므로 이 시점에는 jobId 만 돌려주고
 * FE 는 `GET /api/generation-jobs/{jobId}` 로 상태를 polling 한다.
 */
data class StartGenerationResult(
    /** `story_generation_jobs.id` (DB PK). */
    val jobId: Long,
    /** 작업 종류 — 이번 생성은 "STORYBOARD_STORY" 고정. */
    val jobType: String,
    /** 초기 상태. 보통 "PENDING". */
    val status: String,
)
