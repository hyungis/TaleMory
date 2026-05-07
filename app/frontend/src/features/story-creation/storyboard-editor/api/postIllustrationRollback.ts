import { post } from '../../../../shared/api/client'
import type { SceneId, StoryId } from '../../../../shared/types'

export interface IllustrationRollbackResponse {
  illustrationUrl: string
  version: number
}

export function postIllustrationRollback(
  storyId: StoryId,
  sceneId: SceneId,
): Promise<IllustrationRollbackResponse> {
  return post<IllustrationRollbackResponse>(
    `/stories/${storyId}/scenes/${sceneId}/illustration/rollback`,
  )
}
