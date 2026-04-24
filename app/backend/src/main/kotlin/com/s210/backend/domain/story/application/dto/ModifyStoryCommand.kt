package com.s210.backend.domain.story.application.dto

import com.s210.backend.domain.story.model.Difficulty
import java.time.LocalDate

/**
 * PATCH /api/stories/{id} 유스케이스 커맨드.
 * 모든 필드 nullable — 전달된 값만 부분 업데이트(실제로 step1 단계에서는 대체로 한 번에 전부 세팅되나,
 * 이후 단계에서 부분 수정 가능하도록 모두 optional 로 둔다).
 */
data class ModifyStoryCommand(
    val title: String? = null,
    val difficulty: Difficulty? = null,
    val companionsJson: String? = null,
    val mainCharacterJson: String? = null,
    val travelPlace: String? = null,
    val travelStartDate: LocalDate? = null,
    val travelEndDate: LocalDate? = null,
    /**
     * travel 날짜/장소를 명시적으로 비우고 싶을 수 있으나, PATCH 는 값 미포함 ≠ null 세팅 구분이 불가.
     * 이번 MR 에선 "null 은 미변경" 규약 유지 — 비우기 기능은 후속 PATCH 정책 논의 후 반영.
     */
)
