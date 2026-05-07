import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { postSelectStoryboardPageImageVersion } from '../api/postSelectStoryboardPageImageVersion'
import type { StoryboardPageItem } from '../api/types'
import type { StoryId } from '../../../../shared/types'

interface SelectVariables {
  pageNumber: number
  version: number
}

/**
 * 버전 선택 mutation.
 *
 * 응답:
 *  - 갱신된 `StoryboardPageItem` 1건 (imageUrl 이 새 버전 URL 로 교체된 상태).
 *  - 호출부는 onSuccess 에서 `['storyboard-pages', storyId]` 캐시 invalidate / refetch.
 *  - Redis current 도 BE 가 함께 갱신하므로 `['storyboard-image-versions', storyId, pageNumber]` 도
 *    invalidate 해 picker 의 현재 표시를 갱신.
 */
export function useSelectStoryboardPageImageVersionPost(
  storyId: StoryId | null,
): UseMutationResult<StoryboardPageItem, ApiError, SelectVariables> {
  return useMutation<StoryboardPageItem, ApiError, SelectVariables>({
    mutationFn: ({ pageNumber, version }) => {
      if (storyId === null) throw new Error('storyId 가 없습니다.')
      return postSelectStoryboardPageImageVersion(storyId, pageNumber, { version })
    },
  })
}
