package com.s210.backend.domain.story.presentation.request

import com.s210.backend.domain.story.application.dto.CreateStoryCommand
import com.s210.backend.domain.story.application.dto.ModifyStoryCommand
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.story.model.StoryMode
import jakarta.validation.constraints.NotBlank
import java.time.LocalDate

/**
 * 동화 기본 정보 생성 요청 — BasicInfoStep 종료 시 1회 호출.
 *
 * `companionsJson` / `mainCharacterJson` 은 FE 에서 `JSON.stringify(...)` 한 **문자열**을
 * 그대로 받아 DB 의 JSON 컬럼에 저장한다. 프론트에서 여러 아이 배열/자유 텍스트 동행자 모두
 * 단일 컬럼으로 직렬화해 유연성을 확보하는 전략.
 *
 * `mode` 는 메인 페이지의 모드 선택 모달에서 결정된 값 — VIEWER(기본) / WEBTOON.
 * 누락 시 default VIEWER 로 fallback (기존 흐름 호환).
 */
data class CreateStoryRequest(
    val title: String?,
    @field:NotBlank val difficulty: String,
    val mode: String? = null,
    @field:NotBlank val companionsJson: String,
    @field:NotBlank val mainCharacterJson: String,
    val travelPlace: String? = null,
    val travelStartDate: LocalDate? = null,
    val travelEndDate: LocalDate? = null,
) {
    fun toCommand(userId: Long): CreateStoryCommand = CreateStoryCommand(
        userId = userId,
        title = title,
        difficulty = Difficulty.valueOf(difficulty.uppercase()),
        mode = mode?.let { StoryMode.valueOf(it.uppercase()) } ?: StoryMode.VIEWER,
        companionsJson = companionsJson,
        mainCharacterJson = mainCharacterJson,
        travelPlace = travelPlace,
        travelStartDate = travelStartDate,
        travelEndDate = travelEndDate,
    )
}

/**
 * PATCH /api/stories/{id} 요청.
 * 모든 필드 optional — null 은 "미변경" 으로 해석한다.
 * (FE: BasicInfoStep 에서 뒤로가기 → 값 수정 → 재클릭 시 서버 반영용.)
 */
data class ModifyStoryRequest(
    val title: String? = null,
    val difficulty: String? = null,
    val companionsJson: String? = null,
    val mainCharacterJson: String? = null,
    val travelPlace: String? = null,
    val travelStartDate: LocalDate? = null,
    val travelEndDate: LocalDate? = null,
) {
    fun toCommand(): ModifyStoryCommand = ModifyStoryCommand(
        title = title,
        difficulty = difficulty?.let { Difficulty.valueOf(it.uppercase()) },
        companionsJson = companionsJson,
        mainCharacterJson = mainCharacterJson,
        travelPlace = travelPlace,
        travelStartDate = travelStartDate,
        travelEndDate = travelEndDate,
    )
}

data class ModifyStoryboardPageRequest(
    val englishText: String?,
    val koreanText: String?
)

data class OutroRequest(
    val outroText: String,
    val signature: String?
)

data class PresignedUrlRequest(
    val contentType: String = "audio/webm",
)

data class HighlightVoiceCommitRequest(
    val s3Key: String,
)

data class OutroVoiceCommitRequest(
    val s3Key: String,
)

data class ProgressRequest(
    val lastScenePage: Int
)

data class IllustrationRegenerateRequest(
    val userPrompt: String,
)

data class SelectIllustrationVersionRequest(
    val version: Int,
)

data class BookmarkRequest(
    val isBookmarked: Boolean,
)

data class BgmRequest(
    val bgmPresetId: Long?,
)
