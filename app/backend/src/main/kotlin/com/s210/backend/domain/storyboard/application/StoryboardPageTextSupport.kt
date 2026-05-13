package com.s210.backend.domain.storyboard.application

import com.s210.backend.domain.story.entity.StoryboardPage
import com.s210.backend.domain.storyboard.application.dto.StorySentenceDto
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.readValue

data class StoryboardPageTexts(
    val englishText: String?,
    val koreanText: String?,
)

/**
 * 페이지 본문(영어/한글) 합본 텍스트를 만든다.
 *
 * 두 가지 모드 동작:
 *  - VIEWER: 기존 동작 그대로 — sentences[] 를 공백 1칸으로 join (한 단락처럼 읽힘).
 *  - WEBTOON: sentence 별로 줄바꿈(`\n`) join 하면서 DIALOGUE 면 `${speakerKey}: ${text}` 로 prefix.
 *      NARRATION 또는 speakerKey 가 "narrator" 면 plain text. 위치(`expectedPosition`) 는 사용 안 함.
 *
 * Webtoon 모드 인식 방법:
 *  - sentences 중 한 개라도 type 이 "DIALOGUE" 또는 "NARRATION" 이면 webtoon 페이지로 간주.
 *  - 모든 sentence 의 type 이 null/없음이면 VIEWER (또는 옛 데이터) 로 간주.
 *
 * 이렇게 하면 textarea 표시 본문 자체에 화자 prefix 가 박히기 때문에:
 *  - 사용자가 한글 본문을 직접 편집해도 prefix(이름) 가 일반 글자로 살아남음 → 화자 구분 보존.
 *  - 별도 미리보기 컴포넌트 없이도 textarea 에서 화자별로 자연스럽게 보임.
 */
fun StoryboardPage.pageTexts(objectMapper: ObjectMapper): StoryboardPageTexts {
    val sentences = parseSentencesList(objectMapper)
    val isWebtoon = sentences.any { it.type == "DIALOGUE" || it.type == "NARRATION" }
    return if (isWebtoon) {
        StoryboardPageTexts(
            englishText = joinWebtoonLines(sentences) { it.englishText },
            koreanText = joinWebtoonLines(sentences) { it.koreanText },
        )
    } else {
        StoryboardPageTexts(
            englishText = sentences.joinToString(" ") { it.englishText.trim() }.ifBlank { null },
            koreanText = sentences.joinToString(" ") { it.koreanText.trim() }.ifBlank { null },
        )
    }
}

/**
 * webtoon 페이지의 sentence list 를 줄바꿈 join + DIALOGUE prefix 적용.
 * `pick` 로 한글/영어 중 어느 텍스트를 뽑을지 지정 (두 호출 사이 로직 동일하게 재사용).
 */
private fun joinWebtoonLines(
    sentences: List<StorySentenceDto>,
    pick: (StorySentenceDto) -> String,
): String? {
    return sentences
        .joinToString("\n") { s -> formatWebtoonLine(text = pick(s).trim(), sentence = s) }
        .ifBlank { null }
}

/**
 * sentence 1개를 webtoon 본문 한 줄로 포맷.
 *  - DIALOGUE + speakerKey 가 있고 "narrator" 가 아니면 → `이름: 본문`
 *  - 그 외 (NARRATION, speakerKey 누락, narrator) → 본문 그대로
 */
private fun formatWebtoonLine(text: String, sentence: StorySentenceDto): String {
    val speaker = sentence.speakerKey
    return if (sentence.type == "DIALOGUE" && !speaker.isNullOrBlank() && speaker != "narrator") {
        "$speaker: $text"
    } else {
        text
    }
}

/**
 * 사용자가 한글 본문을 직접 편집하면 (PATCH /storyboard/pages/{n}) 그 결과를 sentences[] 에 반영.
 *
 * 두 가지 경로:
 *  1) WEBTOON 페이지 — 라인 단위 prefix 파서 적용 (Phase 2 X2):
 *      - 입력 텍스트를 줄바꿈으로 split 한 뒤 각 라인을 `이름: 본문` 패턴 매칭.
 *      - 매칭하면 DIALOGUE + speakerKey 로, 안 하면 NARRATION + speakerKey="narrator" 로 분류.
 *      - sentences[].koreanText 에는 prefix 제거된 본문만 저장 → 번역에 prefix 가 흘러가지 않음.
 *      - type/speakerKey 메타가 살아남아 다운스트림 (TTS/scene 분리/표시) 에서 화자 인식 유지.
 *  2) VIEWER 페이지 — 기존 동작 그대로:
 *      - 단일 sentence 로 합쳐서 koreanText 통째 저장.
 *
 * WEBTOON 인지 아닌지 판단:
 *  - 기존 sentences 중 하나라도 `type` 이 "DIALOGUE"/"NARRATION" → WEBTOON 페이지
 *  - 또는 입력 텍스트의 라인 중 하나라도 `이름: 본문` 패턴 매칭 → WEBTOON 으로 간주 (옛 데이터 폴백)
 *  - 둘 다 아니면 VIEWER.
 */
fun StoryboardPage.replaceKoreanText(objectMapper: ObjectMapper, koreanText: String) {
    val existing = parseSentencesList(objectMapper)
    val wasWebtoon = existing.any { it.type == "DIALOGUE" || it.type == "NARRATION" }
    val parsedLines = parseWebtoonLines(koreanText)
    val anyDialoguePrefix = parsedLines.any { it.type == "DIALOGUE" }

    val isWebtoonEdit = wasWebtoon || anyDialoguePrefix
    sentences = if (isWebtoonEdit) {
        objectMapper.writeValueAsString(
            parsedLines.mapIndexed { index, line ->
                val prevAtSameOrder = existing.getOrNull(index)
                StorySentenceDto(
                    sentenceOrder = index + 1,
                    // 영어 본문은 번역 도착 전까지 비워둔다 (replaceTranslatedSentences 에서 채움).
                    // 다만 라인 수가 그대로면 이전 영어를 임시 표시하도록 정렬에 맞춰 흘려준다.
                    englishText = if (parsedLines.size == existing.size) {
                        prevAtSameOrder?.englishText ?: ""
                    } else "",
                    koreanText = line.text,
                    emotion = prevAtSameOrder?.emotion ?: "NEUTRAL",
                    type = line.type,
                    speakerKey = line.speakerKey,
                )
            },
        )
    } else {
        // VIEWER 페이지 — 기존 단일 sentence 합본 동작 유지.
        val englishText = existing.joinToString(" ") { it.englishText.trim() }.ifBlank { "" }
        val emotion = existing.firstOrNull()?.emotion ?: "NEUTRAL"
        objectMapper.writeValueAsString(
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
}

/**
 * 자동 번역 결과 도착 시 sentences[] 갱신 (Phase 2 X2 강화 + 그룹 재합침).
 *
 * 핵심 아이디어:
 *  - 사용자가 한 row 안에 두 문장을 넣으면 (예: "반짝이는 말을 봐! 너무 이쁘지 않아?") AI 번역
 *    service 가 자기 마음대로 sentence 단위로 분리해서 응답할 수 있다 (마침표 기반 split).
 *  - 그러면 sentence 갯수가 늘어나 "한 row 였던 게 두 row 로 보이는" UX 깨짐이 발생.
 *  - 해결: AI 응답 sentences 를 existing 의 sentenceOrder 별로 **그룹화** 한 뒤, 같은 그룹 내
 *    sentence 들을 다시 **합쳐서** 하나의 sentence 로 저장. → existing 갯수 보존.
 *
 * 매칭 알고리즘 (메타 상속 + 그룹 키 결정용):
 *      1) sentenceOrder + koreanText 정확 일치 (가장 빠름)
 *      2) koreanText 정확 일치 (위치 무관)
 *      3) substring 양방향 매칭 (AI 가 한 sentence 를 여러 개로 분리한 경우)
 *      4) sentenceOrder fallback (위치만 같은 sentence)
 *
 * 합치기 규칙:
 *  - englishText / koreanText: 공백으로 join (자연스러운 문장 흐름 유지)
 *  - emotion: 그룹의 첫 sentence 의 비어있지 않은 emotion. 모두 비면 existing 의 emotion 또는 NEUTRAL.
 *  - type / speakerKey: existing 의 메타 그대로 (시스템 truth 보존).
 *
 * 매칭 안 된 orphan incoming (어떤 existing 과도 매칭 실패) 은 끝에 별도 sentence 로 append —
 * 데이터 손실 방지. 일반적으로 발생하지 않지만 robust 하게 처리.
 */
fun StoryboardPage.replaceTranslatedSentences(
    objectMapper: ObjectMapper,
    sentences: List<StorySentenceDto>,
) {
    val existingList = parseSentencesList(objectMapper)
    val sortedIncoming = sentences.sortedBy { it.sentenceOrder }

    // 1. 각 incoming 에 대해 prev (existing) 매칭. null 이면 orphan.
    val withMatch: List<Pair<StorySentenceDto?, StorySentenceDto>> =
        sortedIncoming.map { findExistingMatch(it, existingList) to it }

    // 2. 같은 prev.sentenceOrder 로 그룹화. orphan (prev=null) 은 별도 마지막 그룹.
    val byPrevOrder: Map<Int?, List<StorySentenceDto>> =
        withMatch.groupBy(
            keySelector = { it.first?.sentenceOrder },
            valueTransform = { it.second },
        )

    // 3. existing.sentenceOrder 순서로 결과 sentence 만들기 (각 그룹을 합쳐 1개로).
    val combined = mutableListOf<StorySentenceDto>()
    for (existing in existingList) {
        val grouped = byPrevOrder[existing.sentenceOrder] ?: continue
        combined.add(buildMergedSentence(grouped, existing, combined.size + 1))
    }

    // 4. orphan (어떤 existing 과도 매칭 실패한) incoming 들을 별도 sentence 로 끝에 append.
    val orphans = byPrevOrder[null].orEmpty()
    for (s in orphans) {
        val resolvedSpeakerKey = s.speakerKey
        combined.add(
            StorySentenceDto(
                sentenceOrder = combined.size + 1,
                englishText = stripWebtoonPrefix(s.englishText, resolvedSpeakerKey).trim(),
                koreanText = stripWebtoonPrefix(s.koreanText, resolvedSpeakerKey).trim(),
                emotion = s.emotion.ifBlank { "NEUTRAL" },
                type = s.type,
                speakerKey = resolvedSpeakerKey,
            ),
        )
    }

    this.sentences = objectMapper.writeValueAsString(combined)
}

/**
 * 하나의 그룹(같은 existing 에 매칭된 incoming 들) 을 합쳐 단일 sentence DTO 만들기.
 *  - text 들은 공백 join (자연스러운 문장 연결).
 *  - 메타는 existing 우선 (시스템 truth).
 *  - emotion 은 그룹 첫 비어있지 않은 값, 없으면 existing.emotion, 없으면 NEUTRAL.
 */
private fun buildMergedSentence(
    group: List<StorySentenceDto>,
    existing: StorySentenceDto,
    newOrder: Int,
): StorySentenceDto {
    val resolvedSpeakerKey = existing.speakerKey ?: group.firstOrNull()?.speakerKey
    val resolvedType = existing.type ?: group.firstOrNull()?.type
    val joinedEnglish = group
        .joinToString(" ") { stripWebtoonPrefix(it.englishText, resolvedSpeakerKey).trim() }
        .trim()
    val joinedKorean = group
        .joinToString(" ") { stripWebtoonPrefix(it.koreanText, resolvedSpeakerKey).trim() }
        .trim()
    val emotion = group.firstOrNull { it.emotion.isNotBlank() }?.emotion
        ?: existing.emotion.ifBlank { "NEUTRAL" }
    return StorySentenceDto(
        sentenceOrder = newOrder,
        englishText = joinedEnglish,
        koreanText = joinedKorean,
        emotion = emotion,
        type = resolvedType,
        speakerKey = resolvedSpeakerKey,
    )
}

/**
 * 번역 응답 sentence 1개에 대해 기존 sentences[] 에서 메타 상속 대상 prev 를 찾는다.
 * 매칭 우선순위는 위 함수 KDoc 참조.
 */
private fun findExistingMatch(
    incoming: StorySentenceDto,
    existing: List<StorySentenceDto>,
): StorySentenceDto? {
    if (existing.isEmpty()) return null
    val incomingNormalized = normalizeForMatch(incoming.koreanText)

    // 1차: sentenceOrder 정확 매칭 + 텍스트 일치
    val byOrder = existing.find { it.sentenceOrder == incoming.sentenceOrder }
    if (byOrder != null && normalizeForMatch(byOrder.koreanText) == incomingNormalized) {
        return byOrder
    }

    // 2차: koreanText 정확 일치 (위치 다른 경우 대비)
    existing.find { normalizeForMatch(it.koreanText) == incomingNormalized }?.let { return it }

    // 3차: substring 양방향 매칭
    //   - AI 가 한 한국어 sentence 를 여러 개로 분리 (incoming ⊂ existing) — 분리된 조각이 원본 안에
    //   - 또는 반대로 AI 가 여러 sentence 를 합침 (existing ⊂ incoming) — 원본 조각들이 합본 안에
    if (incomingNormalized.isNotEmpty()) {
        existing.find { ex ->
            val exNorm = normalizeForMatch(ex.koreanText)
            exNorm.isNotEmpty() && (exNorm.contains(incomingNormalized) || incomingNormalized.contains(exNorm))
        }?.let { return it }
    }

    // 4차: sentenceOrder fallback (텍스트 매칭 모두 실패해도 같은 자리 sentence 의 메타 상속)
    return byOrder
}

/** 문자열 정규화 — 공백 제거 + trim. 매칭 견고화 (사용자 입력 공백 변동 흡수). */
private fun normalizeForMatch(text: String?): String {
    if (text == null) return ""
    return text.replace(Regex("\\s+"), "").trim()
}

/**
 * 한글 본문을 webtoon 라인으로 파싱.
 * 빈 줄은 무시. 입력 전체가 빈 문자열이면 빈 리스트.
 *
 * 매칭 패턴:
 *  - `^(\S[^:\n]{0,29}?)\s*:\s*(.+)$` — 콜론 앞 1~30자(공백으로 시작 X), 콜론 뒤 본문.
 *  - 매칭 실패 시 NARRATION (speakerKey="narrator") 으로 분류.
 *
 * 30자 제한은 전형적인 화자 키 길이를 넘는 "Note: ..." 같은 false positive 차단을 위함.
 * 더 엄격한 검증 (charactersInScene 안의 키만 인정 등) 은 후속 phase 에서.
 */
data class WebtoonParsedLine(val type: String, val speakerKey: String, val text: String)

fun parseWebtoonLines(koreanText: String): List<WebtoonParsedLine> {
    val lineRegex = Regex("^(\\S[^:\\n]{0,29}?)\\s*:\\s*(.+)$")
    return koreanText
        .split("\n")
        .mapNotNull { raw ->
            val line = raw.trim()
            if (line.isEmpty()) return@mapNotNull null
            val match = lineRegex.matchEntire(line)
            if (match != null) {
                WebtoonParsedLine(
                    type = "DIALOGUE",
                    speakerKey = match.groupValues[1].trim(),
                    text = match.groupValues[2].trim(),
                )
            } else {
                WebtoonParsedLine(
                    type = "NARRATION",
                    speakerKey = "narrator",
                    text = line,
                )
            }
        }
}

/**
 * sentence 본문에서 webtoon prefix("이름: ") 를 제거 — speakerKey 가 알려져 있을 때만.
 * 번역 publisher 가 clean 본문만 보내도록 했지만, AI 가 그래도 prefix 를 추가했거나
 * 옛 row 마이그레이션 케이스에 대비한 방어 로직.
 */
private fun stripWebtoonPrefix(text: String, speakerKey: String?): String {
    if (speakerKey.isNullOrBlank() || speakerKey == "narrator") return text
    val pattern = Regex("^\\s*${Regex.escape(speakerKey)}\\s*:\\s*", RegexOption.MULTILINE)
    return pattern.replaceFirst(text, "")
}


fun StoryboardPage.parseSentencesList(objectMapper: ObjectMapper): List<StorySentenceDto> {
    val raw = sentences?.takeIf { it.isNotBlank() } ?: return emptyList()
    return runCatching {
        objectMapper.readValue<List<StorySentenceDto>>(raw)
            .sortedBy { it.sentenceOrder }
    }.getOrDefault(emptyList())
}
