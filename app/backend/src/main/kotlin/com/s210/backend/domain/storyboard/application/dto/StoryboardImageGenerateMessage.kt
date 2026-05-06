package com.s210.backend.domain.storyboard.application.dto

/**
 * 스토리보드 이미지 배치 생성 요청 메시지 (Spring → AI).
 *
 * AI 측 스펙 `app/ai/app/schemas/mq_storyboard_image.py` 의 `StoryboardImageGenerateJobMessage` 와 1:1.
 * routing key: "ai.image.generate"
 * exchange:    "ai.request"
 *
 * - 페이지 N 개를 한 envelope 로 보낸다 → AI 워커가 fan-out 해서 페이지당 1개 결과 메시지를 발행.
 * - jobId 는 BE `story_generation_jobs.id`.toString().
 */
data class StoryboardImageGenerateMessage(
    val jobId: String,
    val jobType: String = "STORYBOARD_IMAGE",
    val storyId: Long,
    val payload: StoryboardImageGeneratePayload,
)

/**
 * 배치 페이로드. seed 는 페이지 간 화풍 일관성을 위해 storyId 단위로 결정적인 값을 부여한다.
 * items 는 1..20 (AI 측 max=20 제약).
 *
 * `characterSourceImageS3Keys` — Step 2 에서 사용자가 "대표 사진" 으로 마킹한 사진 (`purpose IN (CHARACTER_REF, BOTH)`)
 * 의 s3Key 들 (max 3). AI 가 이 사진들을 모아 reference.png 를 생성한 뒤 모든 페이지의 일러스트
 * 에 캐릭터 일관성 baseline 으로 적용한다. AI schema 의 동명 필드와 1:1 매칭.
 *  - 빈 배열로 보내면 AI 가 페이지별 referenceImageS3Keys 를 fallback 으로 사용 (AI 측 로직).
 *    그러나 BE 는 Step 3 진입 검증으로 보통 ≥ 1 보장.
 */
data class StoryboardImageGeneratePayload(
    val storyId: Long,
    val seed: Int,
    val characterSourceImageS3Keys: List<String> = emptyList(),
    val items: List<StoryboardImageItem>,
)

/**
 * 페이지 한 장이 그려질 때 AI 가 받는 모든 입력.
 *
 * 데이터 출처(옵션 D'):
 *  - storyboard.{title,synopsis}            → 마지막 SUCCESS STORY 잡의 result_payload
 *  - page.{sceneSummary, englishText, koreanText, imagePrompt}
 *                                           → storyboard_pages (유저 편집 반영됨)
 *  - children, companions                   → Story 의 mainCharacterJson / companionsJson
 *  - referenceImageS3Keys                   → photo_album_items 에서 sourcePhotoIds 로 조회 (≤3)
 */
data class StoryboardImageItem(
    val pageNumber: Int,
    val storyboard: StoryboardImageContext,
    val page: StoryboardImagePagePayload,
    val children: List<ChildInfo>,
    val companions: List<String>,
    val characterReferenceImageS3Keys: List<String> = emptyList(),
    val characterReferenceImageUrls: List<String> = emptyList(),
    val referenceImageS3Keys: List<String>,
    val referenceImageUrls: List<String> = emptyList(),
    val stylePreset: String? = null,
    val additionalInstruction: String? = null,
)

/** 스토리 전역 컨텍스트 — 모든 페이지 item 에 동일하게 부여. */
data class StoryboardImageContext(
    val title: String,
    val synopsis: String,
)

/** 페이지별 텍스트 묶음. 표지(page 0)는 텍스트 없이 pageNumber 만 전달. */
data class StoryboardImagePagePayload(
    val pageNumber: Int,
    val sceneSummary: String? = null,
    val englishText: String? = null,
    val koreanText: String? = null,
    val imagePrompt: String? = null,
)

/**
 * 단일 페이지 이미지 재생성 메시지.
 * routing key: "ai.image.regenerate"
 *
 * 유저가 한 페이지의 이미지를 마음에 안 들어 "다시 그려줘" + 자유 프롬프트를 입력했을 때 사용.
 * AI 는 같은 seed + userPrompt 를 추가 컨텍스트로 받아 그림만 다시 생성한다.
 */
data class StoryboardImageRegenerateMessage(
    val jobId: String,
    val jobType: String = "STORYBOARD_IMAGE",
    val storyId: Long,
    val payload: StoryboardImageRegeneratePayload,
)

/**
 * 재생성 페이로드.
 *
 * - userPrompt: 유저가 입력한 자유 텍스트 (1..2000). AI 가 additionalInstruction 으로 합쳐 사용.
 * - outputVersion: AI 워커가 S3 에 저장할 때 사용할 버전 번호 (versioned key `v{N}.png`).
 *   BE 가 Redis INCR 로 계산해 2, 3, 4, ... 채워 보냄. AI 측 스키마는 `payload.outputVersion`
 *   (top-level, ge=1) 로 받음 — 배치 generate 메시지에는 이 필드가 없음 (항상 v1 deterministic).
 * - item: 배치와 동일한 구조의 페이지 1개 입력.
 */
data class StoryboardImageRegeneratePayload(
    val storyId: Long,
    val seed: Int,
    val userPrompt: String,
    val outputVersion: Int,
    val item: StoryboardImageItem,
)
