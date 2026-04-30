/**
 * Step 3 (스토리보드 줄거리 생성) API 계약 — BE DTO 와 1:1 정합.
 *
 * 관련 명세:
 *  - POST /api/stories/{storyId}/storyboard/summary           (줄거리 1차 생성 trigger)
 *  - POST /api/stories/{storyId}/storyboard/summary/regenerate (자연어 재생성 trigger)
 *  - GET  /api/stories/{storyId}/storyboard/summary           (줄거리 + 잡 상태 조회)
 *  - #28  POST /api/stories/{storyId}/storyboard/story         (본문 발행 — 줄거리 SUCCESS 후 호출)
 *  - #56  GET  /api/generation-jobs/{jobId}
 */

/** `POST /api/stories/{storyId}/storyboard/story` request body. */
export interface GenerateStoryboardStoryRequest {
  /** 사용자가 Step 3 에서 입력한 자유 프롬프트. 빈 문자열/미제공 모두 허용. */
  prompt?: string | null
}

/** `POST /api/stories/{storyId}/storyboard/summary` request body. */
export interface GenerateStoryboardSummaryRequest {
  /** 자유 프롬프트 (선택). 빈 문자열/미제공/null 모두 허용 — BE 가 빈값 정책으로 처리. */
  prompt: string | null
}

/** `POST /api/stories/{storyId}/storyboard/summary/regenerate` request body. */
export interface RegenerateStoryboardSummaryRequest {
  /** 자연어 재생성 명령 (NotBlank — BE @NotBlank 검증). */
  userPrompt: string
}

/** SUMMARY 잡의 상태 enum (BE 측 SummaryJobStatus 와 정합). */
export type SummaryJobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'

/**
 * `GET /api/stories/{storyId}/storyboard/summary` 응답 payload.
 *
 * 5 케이스:
 *  - 잡 한 번도 안 만든 신규 → `{ summaryKo: null, jobStatus: null, jobId: null }` (UI = INPUT)
 *  - PENDING/RUNNING                              → LOADING
 *  - SUCCESS                                      → RESULT (summaryKo 표시)
 *  - FAILED                                       → FAIL
 */
export interface SummaryResponseData {
  summaryKo: string | null
  jobStatus: SummaryJobStatus | null
  /** BE 가 String 으로 직렬화 — FE 에서는 그대로 string 으로 다룬다. */
  jobId: string | null
}

/** SUMMARY 비동기 잡 시작 응답 — `{ jobId, jobType, status }` 포맷. jobId 는 BE 가 string. */
export interface StartGenerationResult {
  jobId: string
  jobType: JobTypeApi
  status: JobStatusApi
}

/**
 * `PATCH /api/stories/{storyId}/storyboard/summary` request body — 옵션 ② 디자인.
 *
 * 사용자가 Step 3 result 화면의 한글 줄거리 textarea 를 편집한 뒤 onBlur 시점에 호출.
 * BE 는 이 값을 stories.synopsis / story_board.story / 최신 SUMMARY 잡의 result_payload.summaryKo
 * 세 곳에 sync 후 본문 발행 시 한글 ground 로 활용한다 (AI 의 영문/한글 필드 양쪽에 복사 송신).
 */
export interface UpdateStoryboardSummaryRequest {
  /** 사용자가 편집한 한글 줄거리 (1자 이상 4000자 이하). */
  summaryKo: string
}

/**
 * `GET /api/stories/{storyId}/storyboard/state` 응답.
 *
 * Step 4 mount 시 1회 호출 — sessionStorage 가 비어있는 엣지케이스 (탭 닫고 재진입) 에서도
 * 본문(STORY) 잡 상태를 BE 진실로부터 알아내기 위함.
 *
 *  - activeJob 가 있으면 polling 재개
 *  - 없고 latestFinalStatus=FAILED + failedCountSinceLastSuccess<3 → "다시 시도" UI
 *  - failedCountSinceLastSuccess>=3 → 한도 초과 — story soft-delete 후 메인 페이지 이동
 */
export interface StoryboardStateResponse {
  activeJob: {
    jobId: number
    status: 'PENDING' | 'RUNNING'
    /** ISO-8601 LocalDateTime — FE 가 polling timeout 카운트 보정에 활용. */
    createdAt: string
  } | null
  latestFinalStatus: 'SUCCESS' | 'FAILED' | 'CANCELLED' | null
  failedCountSinceLastSuccess: number
}

/** `PATCH /api/stories/{storyId}/storyboard/summary` 응답 — 저장된 story_board 스냅샷. */
export interface StoryBoardSnapshot {
  storyBoardId: number
  storyId: number
  prompt: string
  story: string
  createAt: string
  updateAt: string | null
}

/**
 * 비동기 작업 시작 공통 응답 — 명세 공통 규약 `{ jobId, jobType, status }`.
 * 202 Accepted 로 내려온다.
 */
export interface JobStartResponse {
  jobId: number
  jobType: JobTypeApi
  status: JobStatusApi
}

/** 명세 #56 — FE polling 대상. */
export interface GenerationJobResponse {
  jobId: number
  storyId: number
  sentenceId: number | null
  sceneId: number | null
  jobType: JobTypeApi
  status: JobStatusApi
  /** AI 에 보낸 원 요청 JSON. 역직렬화된 중첩 객체. */
  requestPayload: unknown
  /** AI 응답 JSON. 완료 전에는 null. */
  resultPayload: GenerationResultPayload | null
  errorMessage: string | null
  /** 누적 OpenAI 비용 (USD). AI 가 측정 실패 시 null. */
  costUsd: number | null
  /** ISO-8601 LocalDateTime 문자열. */
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  /** 진행 중 단계 설명 (Task 16 BE 추가 — 옵셔널). */
  currentStep?: string | null
  /** 진행률 0~100 (Task 16 BE 추가 — 옵셔널). */
  progress?: number | null
  /** 현재 단계 식별자 (Task 16 BE 추가 — 옵셔널). */
  stage?: string | null
}

export type JobTypeApi =
  | 'STORYBOARD'
  | 'STORYBOARD_STORY'
  | 'ILLUSTRATION'
  | 'TTS'
  | 'BGM'
  | 'VOICE_CLONE'
  | 'STORY'

export type JobStatusApi =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'

/**
 * 성공 응답 payload — Storyboard 텍스트 전체.
 * (일러스트/TTS 는 후속 단계에서 생성되며 이 단계에서는 텍스트만.)
 */
export interface GenerationResultPayload {
  title: string
  synopsis: string
  moralTheme: string
  storyQuest: string
  recurringMotif: string
  pageCount: number
  pageCountReason: string
  readingLevel: {
    basedOnAge: number
    sentencesPerPage: string
    wordsPerSentence: string
    reason: string
  }
  totalWordCount: number
  pages: StoryboardPageSnapshot[]
  usage: {
    model: string
    inputTokens: number | null
    outputTokens: number | null
    totalTokens: number | null
    costUsd: number | null
    promptTemplateVersion: string
  }
}

export interface StoryboardPageSnapshot {
  pageNumber: number
  sourcePhotoIds: number[]
  sceneSummary: string
  englishText: string
  koreanText: string
  /** 나중에 일러스트 생성 단계에서 사용할 힌트 — 현재 화면에서는 저장만. */
  imagePrompt: string
  sentences: {
    sentenceOrder: number
    englishText: string
    koreanText: string
    emotion: string
  }[]
  sentenceCount: number
  wordCount: number
}
