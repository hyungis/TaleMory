import { get, post } from '../../../../shared/api'
import type { JobId, SceneId, StoryId } from '../../../../shared/types'

export interface IllustrationVersionEntry {
  version: number
  url: string
  prompt: string | null
  createdAt: string | null
  jobId: JobId | null
}

export interface IllustrationVersionsResponse {
  storyId: StoryId
  sceneId: SceneId
  current: number | null
  versions: IllustrationVersionEntry[]
}

export interface IllustrationVersionSelectResponse {
  illustrationUrl: string
  version: number
}

export interface IllustrationRegenStatusResponse {
  storyId: StoryId
  used: number
  limit: number
  remaining: number
  /**
   * 현재 PENDING/RUNNING 인 페이지 재생성 잡 정보 (JobType.ILLUSTRATION = 단일 페이지 재생성).
   * 새로고침 직후 FinalPreviewStep 이 polling 컨텍스트(activeRegen)를 BE 진실 기반으로 복원하는 데 사용.
   */
  activeJob: ActiveIllustrationJobView | null
  /**
   * Step 7→8 confirmStoryboard 로 발행된 TTS 잡이 PENDING/RUNNING 이면 그 정보.
   * 크롬 종료 후 "이어 만들기" 진입 시 props storyGenerationJobId 가 비어도 BE 진실로 polling 재개.
   */
  activeTtsJob: ActiveStoryJobView | null
  /**
   * Step 5 PATCH /style 또는 Step 8 다시그리기로 발행된 FINAL_ILLUSTRATION 잡 정보.
   * 동화 단위 batch 잡 — activeJob (페이지 재생성)과 별도.
   */
  activeFinalIllustrationJob: ActiveStoryJobView | null
}

export interface ActiveIllustrationJobView {
  jobId: JobId
  sceneId: SceneId
  status: string
}

/** 동화 단위 잡(TTS / FINAL_ILLUSTRATION) — sceneId 없음. */
export interface ActiveStoryJobView {
  jobId: JobId
  status: string
}

export function getIllustrationVersions(
  storyId: StoryId,
  sceneId: SceneId,
): Promise<IllustrationVersionsResponse> {
  return get<IllustrationVersionsResponse>(
    `/stories/${storyId}/scenes/${sceneId}/illustration/versions`,
  )
}

export function postSelectIllustrationVersion(
  storyId: StoryId,
  sceneId: SceneId,
  version: number,
): Promise<IllustrationVersionSelectResponse> {
  return post<IllustrationVersionSelectResponse>(
    `/stories/${storyId}/scenes/${sceneId}/illustration/select`,
    { version },
  )
}

export function getIllustrationRegenStatus(
  storyId: StoryId,
): Promise<IllustrationRegenStatusResponse> {
  return get<IllustrationRegenStatusResponse>(
    `/stories/${storyId}/scenes/illustration/regen-status`,
  )
}
