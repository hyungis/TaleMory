import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { patchStoryboardSummary } from '../api/patchStoryboardSummary'
import type { StoryBoardSnapshot, UpdateStoryboardSummaryRequest } from '../api/types'
import type { StoryId } from '../../../../shared/types'

/**
 * 한글 줄거리(summaryKo) 편집 mutation — `PATCH /stories/{storyId}/storyboard/summary`.
 *
 * UX:
 *  - Step 3 result 모드의 줄거리 textarea onBlur 시점에 호출.
 *  - 본문 발행이 시작된 이후 (`isLocked=true`) 에는 textarea 가 비활성화되므로 호출되지 않는다.
 *
 * 캐시 정책:
 *  - 성공 시 `['storyboard-summary', storyId]` invalidate — 다음 polling/재진입 시 BE 값과 정합 보장.
 *  - storyboard-pages 는 건드리지 않음 (한글 줄거리는 본문 페이지가 아니므로).
 *
 * 호출부에서 짧은 간격의 다중 onBlur 가 우려되면 debounce 권장. 여기서는 단순화를 위해 매번 호출.
 */
export function useStoryboardSummaryPatch(
  storyId: StoryId | null,
): UseMutationResult<StoryBoardSnapshot, ApiError, UpdateStoryboardSummaryRequest> {
  const queryClient = useQueryClient()
  return useMutation<StoryBoardSnapshot, ApiError, UpdateStoryboardSummaryRequest>({
    mutationFn: body => {
      if (storyId === null) {
        throw new Error('storyId 가 없습니다.')
      }
      return patchStoryboardSummary(storyId, body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['storyboard-summary', storyId] })
    },
  })
}
