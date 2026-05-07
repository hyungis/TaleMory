/**
 * 스토리보드 페이지 단위 API 타입.
 * Step 3 (read-only 통합본) / Step 4 (페이지별 편집) 가 공유한다.
 *
 * BE 측 DTO:
 *  - GET  /api/stories/{storyId}/storyboard/pages          → StoryboardPagesResult
 *  - PATCH /api/stories/{storyId}/storyboard/pages/{n}     → StoryboardPageResult
 */
import type { JobId, StoryId } from '../../../../shared/types'

/** 페이지 1장 — listener 가 채우기 전이거나 image 미생성 상태에선 일부 필드가 null 일 수 있다. */
export interface StoryboardPageItem {
  pageNumber: number
  koreanText: string | null
  englishText: string | null
  sceneSummary: string | null
  imagePrompt: string | null
  imageUrl: string | null
  translationJobId?: JobId | null
  sentences: StoryboardSentenceItem[] | null
}

export interface StoryboardSentenceItem {
  sentenceOrder: number
  englishText: string
  koreanText: string
  emotion: string
}

/** GET 응답. 줄거리 미생성 상태에서도 200 으로 빈 배열 응답. */
export interface StoryboardPagesResponse {
  storyId: StoryId
  pages: StoryboardPageItem[]
}

/** PATCH 요청 body. 한글 본문만 갱신, 길이 제한 4000자. */
export interface UpdateStoryboardPageRequest {
  koreanText: string
}

/** PATCH 응답 — 갱신된 단건 페이지. */
export type UpdateStoryboardPageResponse = StoryboardPageItem

/** 이미지 단일 페이지 재생성 요청 body. */
export interface RegenerateStoryboardImageRequest {
  userPrompt: string
}

/**
 * 비동기 작업 시작 공통 응답 — 명세 공통 규약 `{ jobId, jobType, status }`.
 * 202 Accepted 로 내려온다. 호출부는 jobId 로 `/generation-jobs/{jobId}` 폴링.
 *
 * (storyboard-prompt 에 동일 정의 있음 — 의도적 복제 유지하여 sub-feature 경계 보존.)
 */
export interface JobStartResponse {
  jobId: JobId
  jobType: string
  status: string
}

/**
 * 페이지 이미지 버전 1건 — `GET /storyboard/pages/{n}/image/versions` 응답의 versions 요소.
 *
 * - `version`: 1 = 배치 첫 생성본, 2+ = 재생성본.
 * - `url`: 해당 버전의 versioned S3 URL (`stories/.../v{N}.png`).
 * - `prompt`: 재생성 시 유저 자유 입력. 배치본(v1) 은 null.
 * - `createdAt`: ISO-8601. Redis 에 저장된 시점.
 * - `jobId`: 해당 버전을 만든 STORYBOARD_IMAGE_REGENERATE 잡 id. v1 은 null.
 */
export interface StoryboardImageVersionEntry {
  version: number
  url: string
  prompt: string | null
  createdAt: string | null
  jobId: JobId | null
}

/**
 * `GET /storyboard/pages/{n}/image/versions` 응답.
 *
 * 재생성 이력이 없는 페이지는 `current = null, versions = []` 로 200 응답 →
 * FE 는 picker 자체를 숨긴다.
 */
export interface StoryboardImageVersionsResponse {
  storyId: StoryId
  pageNumber: number
  current: number | null
  versions: StoryboardImageVersionEntry[]
}

/**
 * `POST /storyboard/pages/{n}/image/select` 요청 body.
 *
 * `version` 은 1 이상의 정수. BE 가 Redis 에 실제 존재하는 버전인지 검증.
 */
export interface SelectStoryboardImageVersionRequest {
  version: number
}

/**
 * `GET /storyboard/regen-status` 응답.
 *
 * Step 4 헤더 우측 카운터에 사용. used = SUCCESS+FAILED 합산, limit = BE 정책 상수.
 * `remaining = limit - used` 의 음수 clamp 까지 BE 가 처리해서 내려옴.
 */
export interface StoryboardRegenStatusResponse {
  storyId: StoryId
  used: number
  limit: number
  remaining: number
}
