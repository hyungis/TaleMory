package com.s210.backend.domain.storyboard.application.dto

/**
 * `GET /api/stories/{storyId}/storyboard/pages/{pageNumber}/image/versions` 응답.
 *
 * Step 4 페이지 카드의 버전 picker (드롭다운) 가 그릴 데이터.
 *
 * - `current`: Redis 에 기록된 현재 선택된 버전 번호. 재생성 이력이 없으면 null.
 *   FE 는 null 이면 picker 자체를 숨긴다 (배치본만 있는 페이지엔 선택 UI 불필요).
 * - `versions`: 버전 목록. Redis List 가 LPUSH 기반이라 최신이 앞이지만, 이 응답은
 *   `version` 내림차순 정렬을 보장 — FE 가 정렬 상태를 신경쓰지 않게.
 *   배치본(v1) 은 첫 재생성 시 lazy push 되므로, 한 번이라도 재생성한 페이지엔
 *   v1 부터 vN 까지 모두 들어 있다.
 */
data class StoryboardImageVersionsResult(
    val storyId: Long,
    val pageNumber: Int,
    val current: Int?,
    val versions: List<StoryboardImageVersionEntry>,
)

/**
 * 단일 버전 엔트리.
 *
 * - `version`: 1, 2, 3, ... (1 = 배치 첫 생성본, 2+ = 재생성본)
 * - `url`: 해당 버전의 S3 image URL (versioned suffix 포함, 예: `.../v2.png`)
 * - `prompt`: 재생성 시 유저가 입력한 자유 프롬프트. v1(배치본)은 null.
 * - `createdAt`: ISO-8601 string. Redis 에 기록 시 `Instant.now().toString()` 으로 저장된 값.
 * - `jobId`: 해당 버전을 만든 STORYBOARD_IMAGE_REGENERATE 잡 id. v1 은 null.
 */
data class StoryboardImageVersionEntry(
    val version: Int,
    val url: String,
    val prompt: String?,
    val createdAt: String?,
    val jobId: Long?,
)
