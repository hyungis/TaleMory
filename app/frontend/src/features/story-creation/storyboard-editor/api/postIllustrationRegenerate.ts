import { post } from '../../../../shared/api/client'
import type { JobId, SceneId, StoryId } from '../../../../shared/types'

export interface IllustrationRegenerateResponse {
  jobId: JobId
  status: 'PENDING'
}

export function postIllustrationRegenerate(
  storyId: StoryId,
  sceneId: SceneId,
  userPrompt: string,
): Promise<IllustrationRegenerateResponse> {
  return post<IllustrationRegenerateResponse>(
    `/stories/${storyId}/scenes/${sceneId}/illustration/regenerate`,
    { userPrompt },
  )
}
