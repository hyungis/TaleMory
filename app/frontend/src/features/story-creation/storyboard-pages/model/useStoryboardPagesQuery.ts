import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { getStoryboardPages } from '../api/getStoryboardPages'
import type { StoryboardPagesResponse } from '../api/types'

/**
 * Step 3 / Step 4 공용 — `GET /storyboard/pages` 캐시.
 *
 * - storyId null 이면 disabled (storyId 확보 전 화면).
 * - staleTime 30s — Step3 ↔ Step4 왕복 시 재호출 없이 캐시 사용.
 * - PATCH 성공 시 호출부에서 `queryClient.invalidateQueries(['storyboard-pages', storyId])`
 *   로 강제 갱신.
 * - 줄거리 생성 SUCCESS 직후에도 부모가 invalidate 해서 즉시 새 페이지를 가져오도록.
 */
export function useStoryboardPagesQuery(
  storyId: number | null,
): UseQueryResult<StoryboardPagesResponse, ApiError> {
  return useQuery<StoryboardPagesResponse, ApiError>({
    queryKey: ['storyboard-pages', storyId],
    queryFn: () => getStoryboardPages(storyId as number),
    enabled: storyId !== null,
    staleTime: 30_000,
  })
}
