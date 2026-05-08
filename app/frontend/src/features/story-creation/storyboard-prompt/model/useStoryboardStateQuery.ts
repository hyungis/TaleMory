import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { getStoryboardState } from '../api/getStoryboardState'
import type { StoryboardStateResponse } from '../api/types'
import type { StoryId } from '../../../../shared/types'

/**
 * 본문(STORY) 잡 상태 1회 조회 훅 — `GET /storyboard/state`.
 *
 * 단일 fetch (polling 아님). polling 은 활성 잡 jobId 가 잡힌 후 `useGenerationJobQuery`
 * 가 담당한다. 이 훅은 "현재 어떤 화면을 보여줄지" 결정에만 쓰임.
 *
 * - storyId === null → disabled.
 * - mount 마다 fresh 하게 재조회 (staleTime: 0) — 사용자가 새로고침/탭 닫고 재진입 했을 때
 *   stale 데이터로 잘못된 화면이 노출되지 않도록.
 * - retry 1 — 일시적 네트워크 오류는 한 번 자동 재시도.
 *
 * 사용처:
 *  - Step 4 (StoryboardEditorStep) — sessionStorage 비어있을 때 활성 잡 recovery + 실패 분기
 *  - Step 3 (PromptStep) — 본문 잡 진행 중인 동안 줄거리 락 회복 (proactive lock)
 */
export function useStoryboardStateQuery(
  storyId: StoryId | null,
): UseQueryResult<StoryboardStateResponse, ApiError> {
  return useQuery<StoryboardStateResponse, ApiError>({
    queryKey: ['storyboard-state', storyId],
    queryFn: () => getStoryboardState(storyId as StoryId),
    enabled: storyId !== null,
    staleTime: 0,
    retry: 1,
  })
}
