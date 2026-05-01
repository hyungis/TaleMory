import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { getStoryboardRegenStatus } from '../api/getStoryboardRegenStatus'
import type { StoryboardRegenStatusResponse } from '../api/types'

/**
 * 동화 단위 재생성 카운터 캐시 — Step 4 헤더 우측 `{used}/{limit}` 표시용.
 *
 * - storyId 가 null 이면 disabled.
 * - staleTime 0 — 카운터는 항상 최신값을 보여야 안전. 재생성 mutate 후 강제 invalidate 필요.
 * - 한도 도달(remaining === 0) 이면 모든 페이지 재생성 버튼을 disable.
 */
export function useStoryboardRegenStatusQuery(
  storyId: number | null,
): UseQueryResult<StoryboardRegenStatusResponse, ApiError> {
  return useQuery<StoryboardRegenStatusResponse, ApiError>({
    queryKey: ['storyboard-regen-status', storyId],
    queryFn: () => getStoryboardRegenStatus(storyId as number),
    enabled: storyId !== null,
    staleTime: 0,
  })
}
