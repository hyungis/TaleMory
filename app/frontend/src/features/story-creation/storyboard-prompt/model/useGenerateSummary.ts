import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { postGenerateStoryboardSummary } from '../api/postGenerateStoryboardSummary'
import type { GenerateStoryboardSummaryRequest, StartGenerationResult } from '../api/types'

/**
 * 스토리보드 줄거리(요약) 생성 trigger — `POST /stories/{storyId}/storyboard/summary`.
 *
 * onSuccess 시 `['storyboard-summary', storyId]` 캐시 invalidate 해서
 * polling query 가 바로 PENDING 상태를 반영하도록 한다.
 */
export function useGenerateSummary(
  storyId: number | null,
): UseMutationResult<StartGenerationResult, ApiError, GenerateStoryboardSummaryRequest> {
  const queryClient = useQueryClient()
  return useMutation<StartGenerationResult, ApiError, GenerateStoryboardSummaryRequest>({
    mutationFn: body => {
      if (storyId === null) {
        throw new Error('storyId 가 아직 없습니다. Step 1 저장 후 생성 가능합니다.')
      }
      return postGenerateStoryboardSummary(storyId, body)
    },
    onSuccess: () => {
      if (storyId !== null) {
        void queryClient.invalidateQueries({ queryKey: ['storyboard-summary', storyId] })
      }
    },
  })
}
