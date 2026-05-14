package com.s210.backend.domain.story.application.dto

import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.story.model.StoryMode
import com.s210.backend.domain.story.model.StoryStatus
import java.time.LocalDate
import java.time.LocalDateTime

data class StoryResult(
    val id: Long,
    val title: String?,
    val synopsis: String?,
    val difficulty: Difficulty,
    /** 동화 생성 모드 — VIEWER (기본 narration) / WEBTOON (대화). */
    val mode: StoryMode,
    val status: StoryStatus,
    val isBookmarked: Boolean,
    val shareToken: String?,
    /**
     * step1 의 "동행자" 자유 텍스트를 `JSON.stringify` 한 결과 문자열.
     * DB JSON 컬럼을 그대로 읽어 반환한다 — FE 가 파싱 주체.
     */
    val companionsJson: String,
    /**
     * step1 주인공 배열을 `JSON.stringify` 한 결과 문자열.
     * 요소 예: `[{ "personId": 1, "name": "해솔", "age": 7, "gender": "MALE" }, ...]`
     */
    val mainCharacterJson: String,
    val travelPlace: String?,
    val travelStartDate: LocalDate?,
    val travelEndDate: LocalDate?,
    val publishedAt: LocalDateTime?,
    val createdAt: LocalDateTime,
    /**
     * Step 5 에서 PATCH /style 로 확정된 삽화 스타일 프리셋 id.
     * non-null 이면 FINAL_ILLUSTRATION 잡이 이미 발행돼 스타일 변경 불가.
     * "이어서 작성하기" 진입 시 FE 가 Step 5 락 복원에 사용.
     */
    val stylePresetId: Long?,
    /**
     * Step 6 에서 연결된 보이스 프로필 id.
     * "이어서 작성하기" 진입 시 FE 가 voice 재선택 흐름 판단에 사용.
     */
    val voiceProfileId: Long?,
) {
    companion object {
        fun from(story: Story): StoryResult = StoryResult(
            id = story.id,
            title = story.title,
            synopsis = story.synopsis,
            difficulty = story.difficulty,
            mode = story.mode,
            status = story.status,
            isBookmarked = story.isBookmarked,
            shareToken = story.shareToken,
            companionsJson = story.companionsJson,
            mainCharacterJson = story.mainCharacterJson,
            travelPlace = story.travelPlace,
            travelStartDate = story.travelStartDate,
            travelEndDate = story.travelEndDate,
            publishedAt = story.publishedAt,
            createdAt = story.createdAt,
            stylePresetId = story.stylePresetId,
            voiceProfileId = story.voiceProfileId,
        )
    }
}
