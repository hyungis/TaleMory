package com.s210.backend.domain.storyboard.application

import com.s210.backend.domain.storyboard.application.dto.ChildInfo
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * Story 엔티티의 JSON 문자열 필드(`mainCharacterJson`, `companionsJson`)를
 * AI 페이로드용 Kotlin 모델로 변환하는 헬퍼.
 *
 * StoryboardGenerationService 와 StoryboardImageGenerationService 가 동일한 파싱 로직을
 * 가지고 있어 단일 진실로 추출했다. 향후 동행자 불러오기 기능(person 객체 단위) 등이
 * 들어와도 이 한 곳만 수정하면 두 service 가 자동으로 영향을 받는다.
 *
 * 입력 데이터 가정:
 *  - `mainCharacterJson`: `[{ name, age, gender, personId? }, ...]` (배열)
 *  - `companionsJson`: 자유 텍스트("엄마, 아빠") / 배열(["엄마","아빠"]) / 빈 문자열 모두 허용
 */
@Component
class StoryParticipantParser(
    private val objectMapper: ObjectMapper,
) {

    /**
     * mainCharacterJson 을 ChildInfo 리스트로 정규화.
     * personId 는 AI 가 사용하지 않으므로 제외하고 name/age/gender 만 추출.
     * 필수 필드 누락된 row 는 silently skip.
     */
    fun parseChildren(json: String): List<ChildInfo> {
        val root = parseTreeOrNull(json) ?: return emptyList()
        if (!root.isArray) return emptyList()

        val list = mutableListOf<ChildInfo>()
        for (node in root) {
            val name = node.get("name")?.asString()?.trim()?.takeIf { it.isNotEmpty() } ?: continue
            val age = extractInt(node.get("age")) ?: continue
            val gender = node.get("gender")?.asString()?.uppercase()?.takeIf { it.isNotEmpty() } ?: continue
            list.add(ChildInfo(name, age, gender))
        }
        return list
    }

    /**
     * companionsJson 을 List<String> 으로 정규화.
     * - JSON 배열 → 그대로 string 만 골라냄
     * - JSON 문자열 (자유 텍스트) → 콤마/세미콜론/공백으로 split
     * - 그 외 → 빈 리스트
     */
    fun parseCompanions(json: String): List<String> {
        val root = parseTreeOrNull(json) ?: return emptyList()
        return when {
            root.isString -> splitFreeText(root.asString())
            root.isArray -> root.mapNotNull {
                it.takeIf(JsonNode::isString)?.asString()?.trim()?.takeIf { s -> s.isNotEmpty() }
            }
            else -> emptyList()
        }
    }

    private fun parseTreeOrNull(json: String): JsonNode? =
        if (json.isBlank()) null
        else try { objectMapper.readTree(json) } catch (_: Exception) { null }

    private fun extractInt(node: JsonNode?): Int? = when {
        node == null || node.isNull -> null
        node.isNumber -> node.asInt()
        node.isString -> node.asString().toIntOrNull()
        else -> null
    }

    private fun splitFreeText(raw: String): List<String> =
        raw.split(",", ";", " ")
            .mapNotNull { it.trim().takeIf { t -> t.isNotEmpty() } }
}
