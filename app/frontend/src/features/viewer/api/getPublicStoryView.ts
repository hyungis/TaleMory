import type { StoryView } from '../model/types'
import { apiClient } from '../../../shared/api'

/**
 * 공개 뷰어 조회 API (`GET /api/public/stories/{shareToken}`).
 * 인증 불요 — skipAuth 으로 Bearer 주입 건너뜀.
 */
export async function getPublicStoryView(shareToken: string): Promise<StoryView> {
  return apiClient<StoryView>(`/public/stories/${shareToken}`, { skipAuth: true })
}
