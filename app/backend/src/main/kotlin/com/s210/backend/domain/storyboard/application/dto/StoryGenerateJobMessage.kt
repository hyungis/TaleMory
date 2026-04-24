package com.s210.backend.domain.storyboard.application.dto

/**
 * 스토리 생성 요청 메시지 (Spring → AI).
 *
 * AI 측 스펙 `app/ai/app/schemas/mq_storyboard.py` 의 envelope 와 1:1 매칭된다.
 * routing key: "ai.cpu.story.generate"
 * exchange:    "ai.request"
 *
 * envelope 필드
 *  - jobId:   Spring 이 발급한 UUID v4. `story_generation_jobs.external_id` 와 동일.
 *  - jobType: 현재 "STORY" 고정. 장차 ILLUSTRATION / TTS 등 추가 예정.
 *  - action:  "GENERATE" / "REGENERATE" — 같은 jobType 내 세부 동작 구분.
 *  - storyId: top-level 에만 포함 (payload 내부에는 넣지 않는다 — AI 스펙).
 */
data class StoryGenerateJobMessage(
    val jobId: String,
    val jobType: String = "STORY",
    val action: String = "GENERATE",
    val storyId: Long,
    val payload: StoryGeneratePayload,
)

/**
 * 스토리 생성 payload — AI 가 OpenAI 호출 시 참고할 모든 입력 메타.
 *
 * AI 내부에서 다음 값들은 고정 처리하므로 여기서 보내지 않는다:
 *   pageCountPolicy(min=10, max=20), storybookMagicLevel(FANTASY),
 *   useVision(true), visionDetail(low)
 */
data class StoryGeneratePayload(
    val children: List<ChildInfo>,
    val companions: List<String>,
    val travel: TravelInfo,
    val photos: List<PhotoInput>,
    val difficulty: String,   // BEGINNER | INTERMEDIATE | ADVANCED
    /**
     * 사용자가 Step 3 에서 입력한 자유 프롬프트.
     * AI 스키마의 `additionalInstruction` 필드에 대응.
     */
    val additionalInstruction: String? = null,
)

/** 동화 주인공 아이 정보. gender 는 "MALE" / "FEMALE". */
data class ChildInfo(
    val name: String,
    val age: Int,
    val gender: String,
)

/** 여행 정보. 날짜는 AI 가 문자열로 받음 (시간/타임존 정보 불필요). */
data class TravelInfo(
    val place: String,
    val startDate: String? = null,
    val endDate: String? = null,
)

/**
 * 사진 한 장당 AI 에 넘기는 정보.
 *
 * `s3Key` 만 넘기고 AI 워커가 boto3 로 S3 직접 read → base64 → OpenAI.
 * (presigned URL TTL 만료 리스크 회피)
 */
data class PhotoInput(
    val photoId: Long,
    val s3Key: String,
    val description: String,
    val hashtags: List<String>,
    val displayOrder: Int,
)
