package com.s210.backend.domain.storyboard.presentation.request

import jakarta.validation.constraints.Min

/**
 * `POST /api/stories/{storyId}/storyboard/pages/{pageNumber}/image/select` 요청 body.
 *
 * 유저가 드롭다운에서 특정 버전을 선택하면 호출된다.
 * - `version`: 1 이상의 정수 (1 = 배치본, 2+ = 재생성본).
 *   서비스 레이어에서 Redis 에 실제로 존재하는 버전인지 추가 검증.
 */
data class SelectStoryboardImageVersionRequest(
    @field:Min(value = 1, message = "version 은 1 이상이어야 합니다.")
    val version: Int,
)
