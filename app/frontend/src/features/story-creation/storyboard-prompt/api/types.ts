/**
 * Step 3 (스토리보드 줄거리 생성) API 계약 — BE DTO 와 1:1 정합.
 *
 * 관련 명세:
 *  - #28 POST /api/stories/{storyId}/storyboard/story
 *  - #56 GET  /api/generation-jobs/{jobId}
 */

/** `POST /api/stories/{storyId}/storyboard/story` request body. */
export interface GenerateStoryboardStoryRequest {
  /** 사용자가 Step 3 에서 입력한 자유 프롬프트. 빈 문자열/미제공 모두 허용. */
  prompt?: string | null
}

/** `PATCH /api/stories/{storyId}/storyboard/story` request body. */
export interface UpdateStoryboardStoryRequest {
  /** 사용자가 편집한 synopsis 최종 텍스트 (1자 이상 4000자 이하). */
  story: string
}

/** `PATCH /api/stories/{storyId}/storyboard/story` 응답 — 저장된 story_board 스냅샷. */
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
