package com.s210.backend.domain.storyboard.application

import com.s210.backend.domain.story.entity.StoryboardPage
import com.s210.backend.domain.storyboard.application.dto.StorySentenceDto
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.readValue

data class StoryboardPageTexts(
    val englishText: String?,
    val koreanText: String?,
)

fun StoryboardPage.pageTexts(objectMapper: ObjectMapper): StoryboardPageTexts {
    val sentences = parseSentencesList(objectMapper)
    return StoryboardPageTexts(
        englishText = sentences.joinToString(" ") { it.englishText.trim() }.ifBlank { null },
        koreanText = sentences.joinToString(" ") { it.koreanText.trim() }.ifBlank { null },
    )
}

fun StoryboardPage.replaceKoreanText(objectMapper: ObjectMapper, koreanText: String) {
    val existing = parseSentencesList(objectMapper)
    val englishText = existing.joinToString(" ") { it.englishText.trim() }.ifBlank { "" }
    val emotion = existing.firstOrNull()?.emotion ?: "NEUTRAL"
    sentences = objectMapper.writeValueAsString(
        listOf(
            StorySentenceDto(
                sentenceOrder = 1,
                englishText = englishText,
                koreanText = koreanText,
                emotion = emotion,
            ),
        ),
    )
}

fun StoryboardPage.parseSentencesList(objectMapper: ObjectMapper): List<StorySentenceDto> {
    val raw = sentences?.takeIf { it.isNotBlank() } ?: return emptyList()
    return runCatching {
        objectMapper.readValue<List<StorySentenceDto>>(raw)
            .sortedBy { it.sentenceOrder }
    }.getOrDefault(emptyList())
}
