package com.s210.backend.domain.story.presentation.request

import com.s210.backend.domain.story.application.dto.CreateStoryCommand
import com.s210.backend.domain.story.model.Difficulty
import jakarta.validation.constraints.NotBlank
import java.time.LocalDate

/**
 * 동화 기본 정보 생성 요청 — BasicInfoStep 종료 시 1회 호출.
 *
 * `companionsJson` / `mainCharacterJson` 은 FE 에서 `JSON.stringify(...)` 한 **문자열**을
 * 그대로 받아 DB 의 JSON 컬럼에 저장한다. 프론트에서 여러 아이 배열/자유 텍스트 동행자 모두
 * 단일 컬럼으로 직렬화해 유연성을 확보하는 전략.
 */
data class CreateStoryRequest(
    val title: String?,
    @field:NotBlank val difficulty: String,
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
        companionsJson = companionsJson,
        mainCharacterJson = mainCharacterJson,
        travelPlace = travelPlace,
        travelStartDate = travelStartDate,
        travelEndDate = travelEndDate,
    )
}

data class ModifyStoryRequest(
    val title: String?,
    val difficulty: String?
)

data class PhotoOrderRequest(
    val photoIds: List<Long>
)

data class ModifyPhotoRequest(
    val description: String?,
    val tagsJson: String?
)

data class ModifyStoryboardPageRequest(
    val englishText: String?,
    val koreanText: String?
)

data class OutroRequest(
    val outroText: String,
    val signature: String?
)

data class ProgressRequest(
    val lastScenePage: Int
)
