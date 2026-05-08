import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { getStoryboardPageImageVersions } from '../api/getStoryboardPageImageVersions'
import type { StoryboardImageVersionsResponse } from '../api/types'
import type { StoryId } from '../../../../shared/types'

/**
 * 페이지 1장의 이미지 버전 list 캐시.
 *
 * - storyId / pageNumber 둘 중 하나라도 null 이면 disabled.
 * - staleTime 30s — 같은 step 내 여러 카드가 같은 페이지를 다시 mount 해도 재호출 안 함.
 * - 재생성 SUCCESS 시 호출부에서 `invalidateQueries(['storyboard-image-versions', storyId, pageNumber])`
 *   로 강제 갱신해 새 버전을 picker 에 반영.
 */
export function useStoryboardPageImageVersionsQuery(
  storyId: StoryId | null,
  pageNumber: number | null,
): UseQueryResult<StoryboardImageVersionsResponse, ApiError> {
  return useQuery<StoryboardImageVersionsResponse, ApiError>({
    queryKey: ['storyboard-image-versions', storyId, pageNumber],
    queryFn: () =>
      getStoryboardPageImageVersions(storyId as StoryId, pageNumber as number),
    enabled: storyId !== null && pageNumber !== null,
    staleTime: 30_000,
  })
}
