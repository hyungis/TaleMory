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
    /**
     * 가장 최근 STORYBOARD_IMAGE 배치 잡 1건 (status 무관). 잡 자체가 없으면 null.
     *
     * Step 4 새로고침/탭 재진입 시 IMAGE 배치 polling 을 복구하는 용도.
     *  - status PENDING/RUNNING → FE 가 그 jobId 로 polling 재개
     *  - status SUCCESS         → polling 안 함, 페이지 query 가 image_url 로 결과 렌더
     *  - status FAILED          → polling 안 함, "다시 생성" UI
     *  - null                   → 한 번도 발행 안 한 신규 → idle
     */
    val latestImageJob: LatestImageJob?,
    val activeTranslationJob: ActiveTranslationJob?,
    /**
     * 진행 중인 STORYBOARD_IMAGE_REGENERATE 잡 1건 — 단일 페이지 재생성 polling 복구용.
     *
     * BE 의 동시성 가드(StoryboardImageGenerationService:188-195)로 한 스토리당 PENDING/RUNNING
     * 재생성은 동시 1개만 허용되므로 항상 단일 jobId. 없으면 null.
     *
     * pageNumber 는 jobs.requestPayload (JSON `item.pageNumber`) 에서 BE 가 파싱해 내려준다.
     * FE 는 mount 시 jobId + pageNumber 로 polling 과 페이지별 스피너를 동시에 복구.
     *
     * 새로고침 시 IMAGE 배치 잡 재생성을 끝내고 페이지별 재생성 중이던 상태 → polling 손실 방어.
     */
    val activeImageRegenerateJob: ActiveImageRegenerateJob?,
)

data class ActiveStoryJob(
    val jobId: Long,
    val status: JobStatus,
    val createdAt: LocalDateTime,
)

data class ActiveTranslationJob(
    val jobId: Long,
    val pageNumber: Int?,
    val status: JobStatus,
    val createdAt: LocalDateTime,
)

/**
 * Step 4 IMAGE 배치 잡 복구용 최근 1건 (status 무관).
 * status 만 보면 충분 — 페이지별 진행률은 storyboard_pages query 가 별도로 들고 있다.
 */
data class LatestImageJob(
    val jobId: Long,
    val status: JobStatus,
)

/**
 * 진행 중인 페이지 재생성 잡 (STORYBOARD_IMAGE_REGENERATE / PENDING|RUNNING).
 * pageNumber 는 BE 가 jobs.requestPayload 의 `item.pageNumber` 를 파싱해 내려주는 값.
 */
data class ActiveImageRegenerateJob(
    val jobId: Long,
    val pageNumber: Int,
    val status: JobStatus,
)
