import type { StoryView } from '../model/types'
import { MOCK_STORY_VIEW } from './mockStoryView'
import { apiClient } from '../../../shared/api'

/**
 * 뷰어 통합 조회 API 호출 (`GET /api/stories/{storyId}/view`).
 * 인증 필요 — apiClient 가 자동으로 Bearer 토큰을 주입한다.
 */

const USE_MOCK = import.meta.env.VITE_VIEWER_USE_MOCK === 'true'

export async function getStoryView(storyId: number): Promise<StoryView> {
  if (USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 200))
    return { ...MOCK_STORY_VIEW, storyId }
  }

  return apiClient<StoryView>(`/stories/${storyId}/view`)
}
