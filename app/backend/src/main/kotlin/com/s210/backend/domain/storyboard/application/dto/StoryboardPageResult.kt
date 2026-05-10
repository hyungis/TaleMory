package com.s210.backend.domain.storyboard.application.dto

import com.s210.backend.common.codec.JobId
import com.s210.backend.common.codec.StoryId
import com.s210.backend.domain.story.entity.StoryboardPage
import com.s210.backend.domain.storyboard.application.pageTexts
import com.s210.backend.domain.storyboard.application.parseSentencesList
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.readValue

/**
 * 단일 페이지 응답 DTO.
 * `GET /storyboard/pages` 의 element 와 `PATCH /storyboard/pages/{n}` 의 단건 응답에 공통 사용.
 *
 * 모든 텍스트 필드는 nullable — listener 가 채우기 전이거나 컬럼이 빈 row 도 안전하게 직렬화.
 * `imageUrl` 은 PR-A 시점엔 항상 null. 이미지 생성 단계 (PR-B) 에서 채워짐.
 *
 * WEBTOON 모드 한정 필드 (Phase 2):
 *  - sentences[].type / speakerKey: VIEWER 면 null. WEBTOON 이면 DIALOGUE/NARRATION + 화자 키.
 *  - charactersInScene: 페이지 등장 캐릭터 메타. VIEWER 면 null.
 *
 * 두 필드 모두 nullable 이라 VIEWER 클라이언트는 신경 쓸 필요 없고, WEBTOON 클라이언트가 분기 표시.
 */
data class StoryboardPageResult(
    val pageNumber: Int,
    val koreanText: String?,
    val englishText: String?,
    val sceneSummary: String?,
    val imagePrompt: String?,
    val imageUrl: String?,
    val translationJobId: JobId? = null,
    val sentences: List<StorySentenceDto>?,
    /** WEBTOON 모드 한정. null 또는 빈 배열이면 VIEWER 모드로 간주 가능. */
    val charactersInScene: List<WebtoonCharacterInSceneDto>? = null,
) {
    companion object {
        fun from(
            entity: StoryboardPage,
            objectMapper: ObjectMapper,
            translationJobId: JobId? = null,
        ): StoryboardPageResult {
            val texts = entity.pageTexts(objectMapper)
            val parsedSentences = entity.parseSentencesList(objectMapper)
            val parsedCharacters = parseCharactersInScene(entity.charactersInSceneJson, objectMapper)
            return StoryboardPageResult(
                pageNumber = entity.pageNumber,
                koreanText = texts.koreanText,
                englishText = texts.englishText,
                sceneSummary = entity.sceneSummary,
                imagePrompt = entity.imagePrompt,
                imageUrl = entity.imageUrl,
                translationJobId = translationJobId,
                sentences = parsedSentences.ifEmpty { null },
                charactersInScene = parsedCharacters?.ifEmpty { null },
            )
        }

        /**
         * `storyboard_pages.characters_in_scene_json` 컬럼 raw → DTO list.
         * VIEWER 모드 row 는 null 컬럼 → null 반환.
         * 파싱 실패는 best-effort — null 반환 (응답에서 누락) 후 listener 로그로 추적.
         */
        private fun parseCharactersInScene(
            raw: String?,
            objectMapper: ObjectMapper,
        ): List<WebtoonCharacterInSceneDto>? {
            if (raw.isNullOrBlank()) return null
            return runCatching {
                objectMapper.readValue<List<WebtoonCharacterInSceneDto>>(raw)
            }.getOrNull()
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
    val storyId: StoryId,
    val pages: List<StoryboardPageResult>,
)
