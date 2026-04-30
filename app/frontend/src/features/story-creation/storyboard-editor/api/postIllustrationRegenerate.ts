import { post } from '../../../../shared/api/client'

export interface IllustrationRegenerateResponse {
  jobId: number
  status: 'PENDING'
}

export function postIllustrationRegenerate(
  storyId: number,
  sceneId: number,
  userPrompt: string,
): Promise<IllustrationRegenerateResponse> {
  return post<IllustrationRegenerateResponse>(
    `/stories/${storyId}/scenes/${sceneId}/illustration/regenerate`,
    { userPrompt },
  )
}
