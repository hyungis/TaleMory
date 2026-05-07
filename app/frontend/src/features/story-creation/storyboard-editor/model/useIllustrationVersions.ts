import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import {
  postIllustrationRegenerate,
  type IllustrationRegenerateResponse,
} from '../api/postIllustrationRegenerate'
import {
  postIllustrationRollback,
  type IllustrationRollbackResponse,
} from '../api/postIllustrationRollback'
import type { SceneId, StoryId } from '../../../../shared/types'

interface RegenerateParams {
  storyId: StoryId
  sceneId: SceneId
  userPrompt: string
}

export function useIllustrationRegenerate(): UseMutationResult<
  IllustrationRegenerateResponse,
  ApiError,
  RegenerateParams
> {
  return useMutation<IllustrationRegenerateResponse, ApiError, RegenerateParams>({
    mutationFn: ({ storyId, sceneId, userPrompt }) =>
      postIllustrationRegenerate(storyId, sceneId, userPrompt),
  })
}

interface RollbackParams {
  storyId: StoryId
  sceneId: SceneId
}

export function useIllustrationRollback(): UseMutationResult<
  IllustrationRollbackResponse,
  ApiError,
  RollbackParams
> {
  return useMutation<IllustrationRollbackResponse, ApiError, RollbackParams>({
    mutationFn: ({ storyId, sceneId }) => postIllustrationRollback(storyId, sceneId),
  })
}
