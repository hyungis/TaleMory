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
