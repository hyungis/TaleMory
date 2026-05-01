import { get } from '../../../../shared/api'
import type { StoryboardRegenStatusResponse } from './types'

/**
 * `GET /api/stories/{storyId}/storyboard/regen-status` —
 * 동화 단위 페이지 이미지 재생성 카운터.
 *
 * 응답의 `remaining = limit - used` 가 0 이면 모든 페이지 재생성 버튼이 disabled.
 * Step 4 헤더 우측에 `{used}/{limit}` 형태로 표시.
 */
export function getStoryboardRegenStatus(
  storyId: number,
): Promise<StoryboardRegenStatusResponse> {
  return get<StoryboardRegenStatusResponse>(
    `/stories/${storyId}/storyboard/regen-status`,
  )
}
