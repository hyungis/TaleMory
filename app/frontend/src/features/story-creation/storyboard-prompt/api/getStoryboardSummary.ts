import { get } from '../../../../shared/api'
import type { SummaryResponseData } from './types'

/**
 * 줄거리(요약) + 잡 상태 조회 — `GET /stories/{storyId}/storyboard/summary`.
 *
 * 잡이 한 번도 만들어지지 않은 신규 storyId 도 200 + `{ null, null, null }` 로 응답한다 —
 * 호출부는 `jobStatus` 5 케이스(null/PENDING/RUNNING/SUCCESS/FAILED) 만 분기하면 된다.
 */
export function getStoryboardSummary(storyId: number): Promise<SummaryResponseData> {
  return get<SummaryResponseData>(`/stories/${storyId}/storyboard/summary`)
}
