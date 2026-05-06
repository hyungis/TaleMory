import { get, post } from '../../../../shared/api'

export interface IllustrationVersionEntry {
  version: number
  url: string
  prompt: string | null
  createdAt: string | null
  jobId: number | null
}

export interface IllustrationVersionsResponse {
  storyId: number
  sceneId: number
  current: number | null
  versions: IllustrationVersionEntry[]
}

export interface IllustrationVersionSelectResponse {
  illustrationUrl: string
  version: number
}

export interface IllustrationRegenStatusResponse {
  storyId: number
  used: number
  limit: number
  remaining: number
}

export function getIllustrationVersions(
  storyId: number,
  sceneId: number,
): Promise<IllustrationVersionsResponse> {
  return get<IllustrationVersionsResponse>(
    `/stories/${storyId}/scenes/${sceneId}/illustration/versions`,
  )
}

export function postSelectIllustrationVersion(
  storyId: number,
  sceneId: number,
  version: number,
): Promise<IllustrationVersionSelectResponse> {
  return post<IllustrationVersionSelectResponse>(
    `/stories/${storyId}/scenes/${sceneId}/illustration/select`,
    { version },
  )
}

export function getIllustrationRegenStatus(
  storyId: number,
): Promise<IllustrationRegenStatusResponse> {
  return get<IllustrationRegenStatusResponse>(
    `/stories/${storyId}/scenes/illustration/regen-status`,
  )
}
