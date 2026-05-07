import { get } from '../../../../shared/api'
import type { StoryboardStateResponse } from './types'
import type { StoryId } from '../../../../shared/types'

/**
 * 본문(STORY) 잡 상태 조회 — `GET /stories/{storyId}/storyboard/state`.
 *
 * Step 4 mount 시 1회 호출. sessionStorage 의 storyGenerationJobId 가 비어있어도
 * BE 가 활성 잡 / 직전 terminal status / 마지막 SUCCESS 이후 FAILED 카운트를
 * 한 번에 돌려주므로 FE 는 정확한 화면 분기가 가능하다.
 */
export function getStoryboardState(storyId: StoryId): Promise<StoryboardStateResponse> {
  return get<StoryboardStateResponse>(`/stories/${storyId}/storyboard/state`)
}
