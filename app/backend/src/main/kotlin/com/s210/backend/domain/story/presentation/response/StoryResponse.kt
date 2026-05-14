package com.s210.backend.domain.story.presentation.response

import com.s210.backend.common.codec.JobId
import com.s210.backend.common.codec.PersonId
import com.s210.backend.common.codec.SceneId
import com.s210.backend.common.codec.SentenceId
import com.s210.backend.common.codec.StoryId
import com.s210.backend.common.codec.VoiceProfileId
import java.time.LocalDate
import java.time.LocalDateTime

data class StoryResponse(
    val id: StoryId,
    val title: String?,
    val difficulty: String,
    /** "VIEWER" | "WEBTOON" — 동화 생성 모드. 책장에서 뷰어 분기 및 모드 뱃지 표시용. */
    val mode: String,
    val status: String,
    val isBookmarked: Boolean,
    val travelPlace: String?,
    val travelStartDate: LocalDate?,
    val travelEndDate: LocalDate?,
    val publishedAt: LocalDateTime?,
    val createdAt: LocalDateTime,
    val sceneCount: Int = 0,
    val coverImageUrl: String? = null,
    val shareToken: String? = null,
)

data class StoryDetailResponse(
    val id: StoryId,
    val title: String?,
    val synopsis: String?,
    val difficulty: String,
    val status: String,
    val isBookmarked: Boolean,
    val shareToken: String?,
    val travelPlace: String?,
    val travelStartDate: LocalDate?,
    val travelEndDate: LocalDate?,
    val publishedAt: LocalDateTime?,
    val createdAt: LocalDateTime
)

/**
 * 동화 기본 정보 생성(POST /api/stories) 직후 FE 가 유일하게 필요로 하는 값은 `storyId` 뿐.
 * 후속 step 2~8 에서 다른 리소스를 붙일 때 FK 로 사용한다.
 */
data class StoryCreateResponse(
    val storyId: StoryId,
)

/**
 * GET /api/stories/draft — 로그인 유저의 "진행 중인 동화" 를 BasicInfoStep 상태로 복원하기 위한 페이로드.
 * DRAFT 가 없으면 controller 가 `data = null` 로 내려준다.
 *
 * `stylePresetId`, `voiceProfileId`, `sceneConfirmed` 는 "이어서 작성하기" 진입 시 FE 가
 * 각 step 의 readOnly 락을 BE 진실 기반으로 복원하기 위한 진행 메타.
 *  - `stylePresetId != null` → Step 5 락 (스타일 변경 불가, FINAL_ILLUSTRATION 잡 이미 발행됨)
 *  - `sceneConfirmed = true` → Step 6/7 락 (Step 7→8 confirm 한 번이라도 성공)
 *  - `voiceProfileId` 는 현재 단순 노출 (Step 6 재진입 시 FE 가 voice rehydrate 판단에 사용)
 */
data class StoryDraftResponse(
    val storyId: StoryId,
    val title: String?,
    val difficulty: String,
    /** 동화 생성 모드 — VIEWER (기본 narration) / WEBTOON (대화). 이어서 작성 시 FE 가 모드 복원에 사용. */
    val mode: String,
    val companionsJson: String,
    val mainCharacterJson: String,
    val travelPlace: String?,
    val travelStartDate: LocalDate?,
    val travelEndDate: LocalDate?,
    val createdAt: LocalDateTime,
    val stylePresetId: Long?,
    val voiceProfileId: VoiceProfileId?,
    val sceneConfirmed: Boolean,
)

data class PhotoResponse(
    val id: Long,
    val imageUrl: String,
    val purpose: String,
    val description: String?,
    val displayOrder: Long
)

data class StoryboardPageResponse(
    val id: Long,
    val pageNumber: Int,
    val englishText: String?,
    val koreanText: String?,
    val imageUrl: String?
)

data class SceneResponse(
    val id: SceneId,
    val pageNumber: Int,
    val illustrationUrl: String?,
    val sentences: List<SentenceResponse>
)

data class SentenceResponse(
    val id: SentenceId,
    val sentenceOrder: Int,
    val englishText: String,
    val koreanText: String?,
    val ttsAudioUrl: String?,
    val speakerKey: String?,
    val hasHighlighted: Boolean,
    /**
     * 사용자가 녹음한 강조 문장 audio URL (활성 row 기준).
     * `hasHighlighted=true` 라도 voice row 가 soft-delete 되어있으면 null.
     * Step 7 재진입 시 FE 가 이 값으로 기존 녹음을 복원해 듣기/재녹음 가능 상태로 표시.
     */
    val highlightVoiceUrl: String?,
)

data class OutroResponse(
    val id: Long,
    val outroText: String,
    val audioUrl: String?,
    val signature: String?
)

data class HighlightVoiceResponse(
    val highlightVoiceId: Long,
    val sentenceId: SentenceId,
    val audioUrl: String,
)

data class PresignedUrlResponse(
    val uploadUrl: String,
    val s3Key: String,
    val expiresAt: String,
)

data class ProgressResponse(
    val storyId: StoryId,
    val lastScenePage: Int
)

data class ShareLinkResponse(
    val shareToken: String,
    val shareUrl: String
)

/**
 * 뷰어 화면 통합 조회 응답.
 * 메타 + scenes[] + outro 를 한 번의 호출로 내려 flip 애니메이션 중 네트워크 대기 제거.
 */
data class StoryViewResponse(
    val storyId: StoryId,
    val title: String?,
    /** Story.difficulty.name — "BEGINNER" / "INTERMEDIATE" / "ADVANCED". 뷰어 InvitationCard 의 난이도 pill 에 사용. */
    val difficulty: String,
    /** "VIEWER" | "WEBTOON" — 동화 생성 모드. 뷰어 자동 분기 및 공유 링크 InvitationCard 용. */
    val mode: String,
    val mainCharacter: MainCharacterView?,
    val coverIllustrationUrl: String?,
    val publishedAt: LocalDateTime?,
    val scenes: List<SceneViewResponse>,
    val outro: OutroViewResponse?
)

data class SceneViewResponse(
    val sceneId: SceneId,
    val pageNumber: Int,
    val illustrationUrl: String?,
    val characterAnchors: List<CharacterAnchorView>,
    val sentences: List<SentenceViewResponse>
)

data class SentenceViewResponse(
    val sentenceId: SentenceId,
    val sentenceOrder: Int,
    val englishText: String,
    val koreanText: String?,
    val ttsAudioUrl: String?,
    val speakerKey: String?,
)

data class OutroViewResponse(
    val outroText: String,
    val audioUrl: String?,
    val signature: String?
)

data class MainCharacterView(
    val name: String?
)

/**
 * scene.character_anchors JSON 배열 원소.
 *
 * WEBTOON 모드: WebtoonLayoutResultHandler 가 AI Vision 결과로 페이지별 캐릭터 anchor 를 채운다.
 *  - `name`        : sentence.speakerKey 와 매칭되는 캐릭터 식별자 (FE lookup 키).
 *  - `x`, `y`      : anchor 점 (정규화 0~1, 머리 위 살짝 위 지점).
 *  - `confidence`  : AI Vision 신뢰도 (0~1).
 *
 * 레거시 필드 (`characterId`, `scale`) 는 사용처 없어 nullable 로 유지 — 후속 정리 lane.
 */
data class CharacterAnchorView(
    val name: String? = null,
    val x: Double? = null,
    val y: Double? = null,
    val confidence: Double? = null,
    val characterId: PersonId? = null,
    val scale: Double? = null,
)

/**
 * POST /api/stories/{storyId}/storyboard/confirm 응답.
 * TTS Job 을 큐에 넣고 즉시 반환 (비동기 시작 = 202 Accepted).
 * 전부 캐시 적중(status=SUCCESS)인 경우도 202 로 통일.
 */
data class IllustrationRegenerateResponse(
    val jobId: JobId,
    val status: String,
)

data class IllustrationRollbackResponse(
    val illustrationUrl: String,
    val version: Int,
)

data class IllustrationVersionEntryResponse(
    val version: Int,
    val url: String,
    val prompt: String?,
    val createdAt: String?,
    val jobId: JobId?,
)

data class IllustrationVersionsResponse(
    val storyId: StoryId,
    val sceneId: SceneId,
    val current: Int?,
    val versions: List<IllustrationVersionEntryResponse>,
)

data class IllustrationRegenStatusResponse(
    val storyId: StoryId,
    val used: Int,
    val limit: Int,
    val remaining: Int,
    /**
     * 현재 PENDING/RUNNING 인 페이지 재생성 잡 정보 (JobType.ILLUSTRATION = 단일 페이지 재생성).
     */
    val activeJob: ActiveIllustrationJobView? = null,
    /**
     * Step 7→8 confirmStoryboard 로 발행된 TTS 잡이 PENDING/RUNNING 이면 그 정보.
     * 크롬 종료 후 "이어 만들기" 진입 시 props jobId 가 비어도 BE 진실로 polling 재개.
     */
    val activeTtsJob: ActiveStoryJobView? = null,
    /**
     * Step 5 PATCH /style 또는 Step 8 다시그리기로 발행된 FINAL_ILLUSTRATION 잡 정보.
     * activeJob (페이지 재생성)과 별도로 동화 단위 batch 잡 추적.
     */
    val activeFinalIllustrationJob: ActiveStoryJobView? = null,
)

data class ActiveIllustrationJobView(
    val jobId: JobId,
    val sceneId: SceneId,
    val status: String,
)

/** 동화 단위 잡(TTS / FINAL_ILLUSTRATION) — sceneId 없음. */
data class ActiveStoryJobView(
    val jobId: JobId,
    val status: String,
)

data class ConfirmStoryboardResponse(
    val jobId: JobId,
    val jobType: String,
    val status: String,
    val sceneCount: Int,
    val sentenceCount: Int,
    val cacheHits: Int,
    val cacheMisses: Int,
    val finalIllustrationJobId: JobId? = null,
)

/**
 * Step 8 미리보기에서 잡 실패 후 사용자가 [다시 시도] 했을 때의 응답.
 * 새로 발행된 (또는 멱등 가드로 재사용된) 잡의 id 만 내려준다 — FE 가 polling 재개에 사용.
 */
data class JobRetryResponse(
    val jobId: JobId,
)

/**
 * Step 7 진입 시점의 `POST /api/stories/{storyId}/scenes/prepare` 응답.
 *
 * `storyboard_pages.sentences` JSON 으로부터 scene/scene_sentence 를 평탄화한 결과 요약.
 * 이미 prepared 된 상태라면 `alreadyPrepared = true` (멱등) — FE 는 그대로 GET /scenes 로 진행.
 */
data class ScenesPrepareResponse(
    val sceneCount: Int,
    val sentenceCount: Int,
    val alreadyPrepared: Boolean,
)

/**
 * Step 4 본문 재생성 경고 모달 트리거용 — 활성 강조 녹음이 하나라도 있으면 `exists = true`.
 * 응답이 true 면 FE 는 "본문 재생성 시 강조 녹음 삭제됨" 경고 모달을 띄운다.
 */
data class HighlightVoicesExistsResponse(
    val exists: Boolean,
)
