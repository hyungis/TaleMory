import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { patchStoryboardPage } from '../api/patchStoryboardPage'
import type { UpdateStoryboardPageResponse } from '../api/types'
import type { StoryId } from '../../../../shared/types'

interface PagePatchVariables {
  pageNumber: number
  koreanText: string
}

/**
 * 페이지 한글 본문 수정 mutation.
 *
 * 성공 시 `['storyboard-pages', storyId]` 캐시 무효화 → Step 3 (read-only) /
 * Step 4 (페이지별 카드) 가 자동으로 새 데이터를 가져와 반영한다.
 */
export function useStoryboardPagePatch(
  storyId: StoryId | null,
): UseMutationResult<UpdateStoryboardPageResponse, ApiError, PagePatchVariables> {
  const queryClient = useQueryClient()
  return useMutation<UpdateStoryboardPageResponse, ApiError, PagePatchVariables>({
    mutationFn: ({ pageNumber, koreanText }) => {
      if (storyId === null) throw new Error('storyId 가 없습니다.')
      return patchStoryboardPage(storyId, pageNumber, { koreanText })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['storyboard-pages', storyId] })
    },
  })
}
