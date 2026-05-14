package com.s210.backend.domain.storyboard.application.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

// ==========================================================================
// BE → AI publish (request)
// ==========================================================================
//
// AI 측 매핑 (app/ai/app/schemas/mq_final_illustration.py):
//   - FinalIllustrationLayoutJobMessage      ←→ FinalIllustrationLayoutBatchMessage
//   - FinalIllustrationLayoutItemJobMessage  ←→ FinalIllustrationLayoutItemMessage
//
// jobType 은 FINAL_ILLUSTRATION 으로 고정 — Option A (단일 jobId, 최종 삽화 잡과 공유) 정책상
// AI 워커가 같은 envelope 패밀리로 인식. jobId 도 FINAL_ILLUSTRATION 잡 PK 의 String.
//
// Layout RETRY (사용자 수동 재시도) 만 별도 jobType=WEBTOON_LAYOUT_RETRY 의 자체 잡 row 를 가지고
// 같은 publish DTO 를 재사용한다 — AI 가 분간할 필요 없음 (큐가 아이템 큐로 분리됨).

/** 최종 삽화 단계 마무리 직후 BE 가 AI 로 publish 하는 좌표 추출 batch 메시지. */
data class FinalIllustrationLayoutBatchMessage(
    val jobId: String,
    val jobType: String = "FINAL_ILLUSTRATION",
    val storyId: Long,
    val payload: FinalIllustrationLayoutBatchPayload,
)

/** 부분 실패 또는 사용자 수동 재시도 시 BE 가 publish 하는 단건 좌표 추출 메시지. */
data class FinalIllustrationLayoutItemMessage(
    val jobId: String,
    val jobType: String = "FINAL_ILLUSTRATION",
    val storyId: Long,
    val payload: FinalIllustrationLayoutItemPayload,
)

data class FinalIllustrationLayoutBatchPayload(
    /** AI 측은 batch 안의 items 만 본다 — top-level storyId 는 envelope 으로 따로 전달. */
    val items: List<FinalIllustrationLayoutItemPayload>,
)

/**
 * 단일 페이지의 좌표 추출 요청 페이로드.
 *
 * AI [`FinalIllustrationLayoutAnalysisRequest`] 와 1:1.
 *
 * 요구사항:
 *   - imageUrl 또는 imageS3Key 둘 중 하나 필수.
 *   - DIALOGUE 문장의 speakerKey 가 있어야 AI 가 그 캐릭터 anchor 만 추출.
 *     speakerKey 가 없는 NARRATION 문장은 AI 호출 비용 절약 차원에서 sentences 에서 제외해도 된다 —
 *     BE 는 NARRATION 좌표를 (0.5, 0.05) 로 자체 주입.
 */
data class FinalIllustrationLayoutItemPayload(
    val pageNumber: Int,
    val imageUrl: String? = null,
    val imageS3Key: String? = null,
    val sceneSummary: String? = null,
    val imagePrompt: String? = null,
    val children: List<ChildInfo> = emptyList(),
    /** AI worker 의 charactersInScene 메타 (storyboard_pages.characters_in_scene_json). */
    val charactersInScene: List<Map<String, Any?>> = emptyList(),
    val companions: List<String> = emptyList(),
    val sentences: List<LayoutSentenceInput> = emptyList(),
)

data class LayoutSentenceInput(
    val sentenceOrder: Int,
    val englishText: String? = null,
    val koreanText: String? = null,
    val speakerKey: String? = null,
)

// ==========================================================================
// AI → BE publish (result envelope)
// ==========================================================================
//
// AI 측 매핑 (app/ai/app/schemas/mq_final_illustration.py):
//   - FinalIllustrationLayoutSuccessEnvelope (type = ANALYZE_FINAL_ILLUSTRATION_LAYOUT_COMPLETED)
//   - FinalIllustrationLayoutFailureEnvelope (type = ANALYZE_FINAL_ILLUSTRATION_LAYOUT_FAILED)
//
// AI 는 페이지별로 envelope 1개씩 publish (fan-out). BE 는 routing key `ai.result.layout.*` 를
// 통해 RESULT_QUEUE 로 받아서 StoryboardResultListener 가 type 으로 분기.

@JsonIgnoreProperties(ignoreUnknown = true)
data class FinalIllustrationLayoutResultEnvelope(
    val jobId: String,
    val type: String,            // ANALYZE_FINAL_ILLUSTRATION_LAYOUT_COMPLETED / FAILED
    val storyId: Long,
    val pageNumber: Int? = null, // FAILED 일 땐 null 가능
    val status: String,          // COMPLETED / FAILED
    val payload: FinalIllustrationLayoutResultPayload? = null,
    val error: FinalIllustrationLayoutResultError? = null,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class FinalIllustrationLayoutResultPayload(
    val pageNumber: Int,
    val model: String? = null,
    val characters: List<CharacterAnchorCandidate> = emptyList(),
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class CharacterAnchorCandidate(
    /** speakerKey 또는 캐릭터 식별자 — sentence.speakerKey 와 매칭에 사용. */
    val name: String,
    val bbox: LayoutBoundingBox,
    val anchor: LayoutAnchor,
    val confidence: Double,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class LayoutBoundingBox(
    val x: Double,
    val y: Double,
    val width: Double,
    val height: Double,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class LayoutAnchor(
    val x: Double,
    val y: Double,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class FinalIllustrationLayoutResultError(
    val code: String,
    val message: String,
)
