import { post } from '../../../../shared/api/client'

export interface IllustrationRollbackResponse {
  illustrationUrl: string
  version: number
}

export function postIllustrationRollback(
  storyId: number,
  sceneId: number,
): Promise<IllustrationRollbackResponse> {
  return post<IllustrationRollbackResponse>(
    `/stories/${storyId}/scenes/${sceneId}/illustration/rollback`,
  )
}
