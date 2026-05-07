import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { postRegenerateStoryboardSummary } from '../api/postRegenerateStoryboardSummary'
import type { RegenerateStoryboardSummaryRequest, StartGenerationResult } from '../api/types'
import type { StoryId } from '../../../../shared/types'

/**
 * 줄거리(요약) 자연어 재생성 — `POST /stories/{storyId}/storyboard/summary/regenerate`.
 *
 * 직전 SUCCESS 잡이 있어야만 BE 가 받아준다 (STORY_011 SUMMARY_NOT_FOUND 에러 가능).
 * onSuccess 시 polling query invalidate.
 */
export function useRegenerateSummary(
  storyId: StoryId | null,
): UseMutationResult<StartGenerationResult, ApiError, RegenerateStoryboardSummaryRequest> {
  const queryClient = useQueryClient()
  return useMutation<StartGenerationResult, ApiError, RegenerateStoryboardSummaryRequest>({
    mutationFn: body => {
      if (storyId === null) {
        throw new Error('storyId 가 아직 없습니다. Step 1 저장 후 생성 가능합니다.')
      }
      return postRegenerateStoryboardSummary(storyId, body)
    },
    onSuccess: () => {
      if (storyId !== null) {
        void queryClient.invalidateQueries({ queryKey: ['storyboard-summary', storyId] })
      }
    },
  })
}
