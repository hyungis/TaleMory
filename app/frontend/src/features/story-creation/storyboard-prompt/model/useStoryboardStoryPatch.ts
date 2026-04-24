import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { patchStoryboardStory } from '../api/patchStoryboardStory'
import type { StoryBoardSnapshot, UpdateStoryboardStoryRequest } from '../api/types'

/**
 * 유저 편집 반영 — `PATCH /stories/{storyId}/storyboard/story`.
 *
 * UX: Step 3 result 모드의 synopsis textarea onBlur 시점에 호출.
 * 다수 호출이 짧은 간격으로 일어날 수 있어, 호출부에서 debounce 를 거는 것을 권장.
 */
export function useStoryboardStoryPatch(
  storyId: number | null,
): UseMutationResult<StoryBoardSnapshot, ApiError, UpdateStoryboardStoryRequest> {
  return useMutation<StoryBoardSnapshot, ApiError, UpdateStoryboardStoryRequest>({
    mutationFn: body => {
      if (storyId === null) {
        throw new Error('storyId 가 없습니다.')
      }
      return patchStoryboardStory(storyId, body)
    },
  })
}
