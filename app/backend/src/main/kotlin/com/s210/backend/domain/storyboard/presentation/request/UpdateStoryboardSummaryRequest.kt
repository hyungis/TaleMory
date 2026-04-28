package com.s210.backend.domain.storyboard.presentation.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/**
 * `PATCH /api/stories/{storyId}/storyboard/summary` 요청 body.
 *
 * 옵션 ② 디자인 — 사용자가 Step 3 에서 직접 편집한 한글 줄거리(summaryKo) 를 그대로 저장한다.
 *  - 변경된 한글은 본문(STORY) 잡 발행 시 `stories.synopsis` 에서 읽혀 AI 의 한글 ground 가 됨.
 *  - AI 워커는 ApprovedStorySummary.summary 와 .summaryKo 둘 다 required 라 BE 가 양쪽 모두에
 *    같은 한글 값을 채워서 보낸다 (StoryboardGenerationService.generate 참고).
 *
 *  허용 길이: 1~4000자. AI 응답의 평균 summaryKo 길이는 250~600자이며, 사용자가 손볼 여유까지
 *  고려해 4000자 상한을 둔다 (TEXT 컬럼 자체는 더 큰 입력도 받지만 UX 가이드용 상한).
 */
data class UpdateStoryboardSummaryRequest(
    @field:NotBlank(message = "summaryKo 는 비어있을 수 없습니다.")
    @field:Size(max = 4000, message = "summaryKo 는 최대 4000자까지 입력 가능합니다.")
    val summaryKo: String,
)
