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

interface RegenerateParams {
  storyId: number
  sceneId: number
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
  storyId: number
  sceneId: number
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
