package com.s210.backend.domain.storyboard.application.dto

import com.s210.backend.domain.job.model.JobStatus
import java.time.LocalDateTime

/**
 * `GET /api/stories/{storyId}/storyboard/state` 응답 — Step 4 mount 시 본문(STORY) 잡의
 * 진행/실패 상태를 한 번에 가져와 sessionStorage 가 비어있는 엣지케이스 (탭 닫고 재진입)
 * 에서도 정확한 화면 분기가 가능하도록 한다.
 *
 *  - `activeJob != null` → PENDING/RUNNING. FE 는 그 jobId 로 polling 재개.
 *  - `activeJob == null && latestFinalStatus == FAILED && failedCountSinceLastSuccess < 3`
 *      → FE 는 "다시 시도" 버튼 노출.
 *  - `activeJob == null && failedCountSinceLastSuccess >= 3`
 *      → 한도 초과. FE 는 안내 + 카운트다운 후 메인 페이지 이동 + story soft-delete.
 *  - `activeJob == null && latestFinalStatus == SUCCESS` 또는 `null`
 *      → 정상 흐름. FE 는 storyboard-pages 로 동작.
 */
data class StoryboardStateResult(
    /** 진행 중 본문 잡 (PENDING/RUNNING). 없으면 null. */
    val activeJob: ActiveStoryJob?,
    /**
     * 활성 잡이 없을 때, 가장 최근 본문 잡의 status (terminal 만).
     * 활성 잡이 있거나 본문 잡 자체가 없으면 null.
     */
    val latestFinalStatus: JobStatus?,
    /**
     * 마지막 SUCCESS 이후 FAILED 본문 잡 개수. SUCCESS 가 없으면 모든 FAILED 누적.
     * 3 이상이면 FE 는 "한도 초과" 흐름.
     */
    val failedCountSinceLastSuccess: Long,
)

data class ActiveStoryJob(
    val jobId: Long,
    val status: JobStatus,
    val createdAt: LocalDateTime,
)
