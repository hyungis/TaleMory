import type { StoryView } from '../model/types'
import { apiClient } from '../../../shared/api'

/**
 * 샘플 동화책 조회 API (`GET /api/public/stories/sample`).
 * 인증 불요 — About 페이지에서 샘플 뷰어용으로 사용.
 */
export async function getSampleStoryView(): Promise<StoryView> {
  return apiClient<StoryView>('/public/stories/sample', { skipAuth: true })
}
