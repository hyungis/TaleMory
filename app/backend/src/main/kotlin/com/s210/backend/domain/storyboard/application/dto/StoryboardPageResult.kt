package com.s210.backend.domain.storyboard.application.dto

import com.s210.backend.domain.story.entity.StoryboardPage
import com.s210.backend.domain.storyboard.application.pageTexts
import com.s210.backend.domain.storyboard.application.parseSentencesList
import tools.jackson.databind.ObjectMapper

/**
 * 단일 페이지 응답 DTO.
 * `GET /storyboard/pages` 의 element 와 `PATCH /storyboard/pages/{n}` 의 단건 응답에 공통 사용.
 *
 * 모든 텍스트 필드는 nullable — listener 가 채우기 전이거나 컬럼이 빈 row 도 안전하게 직렬화.
 * `imageUrl` 은 PR-A 시점엔 항상 null. 이미지 생성 단계 (PR-B) 에서 채워짐.
 */
data class StoryboardPageResult(
    val pageNumber: Int,
    val koreanText: String?,
    val englishText: String?,
    val sceneSummary: String?,
    val imagePrompt: String?,
    val imageUrl: String?,
    val sentences: List<StorySentenceDto>?,
) {
    companion object {
        fun from(entity: StoryboardPage, objectMapper: ObjectMapper): StoryboardPageResult {
            val texts = entity.pageTexts(objectMapper)
            val parsedSentences = entity.parseSentencesList(objectMapper)
            return StoryboardPageResult(
                pageNumber = entity.pageNumber,
                koreanText = texts.koreanText,
                englishText = texts.englishText,
                sceneSummary = entity.sceneSummary,
                imagePrompt = entity.imagePrompt,
                imageUrl = entity.imageUrl,
                sentences = parsedSentences.ifEmpty { null },
            )
        }
    }
}

/**
 * `GET /storyboard/pages` 응답 — 한 storyId 의 페이지 list.
 *
 * - 줄거리가 아직 생성되지 않은 상태(storyboard 비어있음)에선 `pages = []` 로 응답.
 *   (FE 가 placeholder 표시할 수 있도록 200 OK 로 반환.)
 * - 페이지는 항상 `pageNumber` 오름차순으로 정렬되어 있다.
 */
data class StoryboardPagesResult(
    val storyId: Long,
    val pages: List<StoryboardPageResult>,
)
