import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { postRegenerateStoryboardImage } from '../api/postRegenerateStoryboardImage'
import type { JobStartResponse } from '../api/types'
import type { StoryId } from '../../../../shared/types'

interface RegenerateVariables {
  pageNumber: number
  userPrompt: string
}

/**
 * 페이지 단일 이미지 재생성 mutation.
 * 응답의 jobId 로 호출부에서 폴링.
 */
export function useRegenerateStoryboardImagePost(
  storyId: StoryId | null,
): UseMutationResult<JobStartResponse, ApiError, RegenerateVariables> {
  return useMutation<JobStartResponse, ApiError, RegenerateVariables>({
    mutationFn: ({ pageNumber, userPrompt }) => {
      if (storyId === null) throw new Error('storyId 가 없습니다.')
      return postRegenerateStoryboardImage(storyId, pageNumber, { userPrompt })
    },
  })
}
