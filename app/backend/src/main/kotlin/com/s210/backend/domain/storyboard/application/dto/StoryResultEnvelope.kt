package com.s210.backend.domain.storyboard.application.dto

/**
 * 스토리 생성 결과 메시지 (AI → Spring).
 *
 * AI 측 스펙 `app/ai/app/schemas/mq_storyboard.py` 의
 * StorySuccessEnvelope / StoryFailureEnvelope 를 하나의 Kotlin DTO 로 합쳤다.
 *
 * exchange:    "ai.result"
 * routing key: "ai.result.story.generate.completed" 또는 ".failed"
 *
 * 필드
 *  - status:  "COMPLETED" / "FAILED" — 이 값으로 payload 와 error 중 어느 쪽을 읽을지 판단.
 *  - type:    "GENERATE_STORY_COMPLETED" / "GENERATE_STORY_FAILED" (규약 문서용).
 *  - jobId:   Spring 이 보낸 jobId 그대로 되돌려 받음 → external_id 로 Job 조회.
 *  - payload: 성공 시에만 값 존재.
 *  - error:   실패 시에만 값 존재.
 */
data class StoryResultEnvelope(
    val jobId: String,
    val type: String,
    val storyId: Long? = null,
    val status: String,
    val payload: StoryboardPayload? = null,
    val error: StoryError? = null,
)

/**
 * 실제 생성된 동화 본문 + 메타데이터.
 * AI 쪽 `StoryboardGenerateResponse` 와 1:1 매칭.
 *
 * 현재 이 범위에서 생성되는 것은 "텍스트" 까지.
 * pages[].imagePrompt 는 나중에 일러스트 생성 단계에서 사용할 힌트 문자열.
 */
data class StoryboardPayload(
    val title: String,
    val synopsis: String,
    val moralTheme: String,
    val storyQuest: String,
    val recurringMotif: String,
    val pageCount: Int,
    val pageCountReason: String,
    val readingLevel: ReadingLevel,
    val totalWordCount: Int,
    val pages: List<StoryboardPageDto>,
    val usage: UsageInfo,
)

/**
 * 아이 연령 / 난이도에 따라 AI 가 추천한 페이지 텍스트 가이드.
 * (실제 페이지 생성은 이미 이 가이드에 맞춰져 있고, 프론트 노출용 정보는 optional)
 */
data class ReadingLevel(
    val basedOnAge: Int,
    val sentencesPerPage: String,
    val wordsPerSentence: String,
    val reason: String,
)

/**
 * 동화 페이지 1장.
 * - sourcePhotoIds: 이 페이지를 만들 때 영감이 된 사진 id 목록 (Step 2 photos[].photoId).
 *                  0건일 수도 있다 (전환 페이지, 감정 페이지 등).
 * - imagePrompt:   나중에 일러스트 생성할 때 쓸 AI 힌트. 현재 단계에서는 저장만.
 * - charactersInScene:
 *      WEBTOON 모드 한정. AI 의 WebtoonStoryboardPage.charactersInScene 와 1:1.
 *      VIEWER 모드 응답에선 null (필드 미전송) — Jackson 의 ignoreUnknownProperties 설정으로
 *      페이로드가 어느 모드든 deserialize 가능.
 */
data class StoryboardPageDto(
    val pageNumber: Int,
    val sourcePhotoIds: List<Int>,
    val sceneSummary: String,
    val englishText: String,
    val koreanText: String,
    val imagePrompt: String,
    val sentences: List<StorySentenceDto>,
    val sentenceCount: Int,
    val wordCount: Int,
    /** WEBTOON 모드 한정. null 또는 빈 배열이면 VIEWER 모드. */
    val charactersInScene: List<WebtoonCharacterInSceneDto>? = null,
)

/**
 * 한 페이지 안의 문장 1개.
 *
 *  - emotion 은 TTS 단계에서 톤 제어에 사용 (NEUTRAL / HAPPY / SAD / ... / BRAVE).
 *  - **type / speakerKey 는 WEBTOON 모드 한정** —
 *      AI 의 WebtoonStorySentence.type ("DIALOGUE" / "NARRATION") + speakerKey 와 1:1.
 *      VIEWER 모드 페이로드에는 두 필드가 없으므로 null (Jackson 이 기본값 사용).
 *      WEBTOON 모드라도 NARRATION 문장은 speakerKey="narrator" 로 일관되게 들어옴.
 */
data class StorySentenceDto(
    val sentenceOrder: Int,
    val englishText: String,
    val koreanText: String,
    val emotion: String,
    /** WEBTOON 모드 한정 — "DIALOGUE" / "NARRATION". VIEWER 면 null. */
    val type: String? = null,
    /** WEBTOON 모드 한정 — 화자 키 (DIALOGUE 면 캐릭터키, NARRATION 면 "narrator"). VIEWER 면 null. */
    val speakerKey: String? = null,
)

/**
 * WEBTOON 모드 페이지에 등장하는 캐릭터 메타.
 * AI 의 WebtoonCharacterInScene 와 1:1.
 *
 *  - characterKey:     speakerKey 와 동일 도메인. mainCharacterJson / companionsJson 에 있는 인물 키.
 *  - sceneRole:        이 페이지에서 캐릭터가 무엇을 하는지 (자유 텍스트, FE 도우미용).
 *  - expectedPosition: "left" / "center" / "right" / "top-left" / "bottom-right" 등 — 컷 구도 힌트.
 *
 * BE 는 받아서 그대로 영속화 (storyboard_pages.characters_in_scene_json) 후 응답에 노출.
 * 현재 시점엔 의미 해석 X — 그대로 패스스루.
 */
data class WebtoonCharacterInSceneDto(
    val characterKey: String,
    val sceneRole: String,
    val expectedPosition: String,
)

/**
 * OpenAI 호출 비용/토큰 정보. `story_generation_jobs.cost_usd` 에 저장해 누적 비용 추적.
 * null 이 올 수 있는 필드는 AI 가 측정 실패 시 비워둘 수 있음.
 */
data class UsageInfo(
    val model: String,
    val inputTokens: Int? = null,
    val outputTokens: Int? = null,
    val totalTokens: Int? = null,
    val costUsd: Double? = null,
    val promptTemplateVersion: String,
)

/**
 * 실패 응답의 에러 정보.
 * code 예: "GENERATE_STORY_ERROR", "GENERATE_STORY_RUNTIME_ERROR"
 */
data class StoryError(
    val code: String,
    val message: String,
)

/**
 * 범용 AI 결과 에러 정보 (TTS, Image 등 다양한 AI 작업에서 재사용).
 * code 예: "GENERATE_TTS_ERROR", "GENERATE_TTS_RUNTIME_ERROR"
 */
typealias AiError = StoryError
