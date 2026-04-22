import type { StoryView } from '../model/types'
import { MOCK_STORY_VIEW } from './mockStoryView'

/**
 * 뷰어 통합 조회 API 호출 (`GET /api/stories/{storyId}/view`).
 *
 * 현재는 Mock 모드 — 로그인/토큰 인프라가 완성되면 실제 호출 경로를 활성화한다.
 * 스위치: `VITE_VIEWER_USE_MOCK=false` 환경변수로 실 호출 모드 전환 예정 (인증 준비 후).
 */

const USE_MOCK = import.meta.env.VITE_VIEWER_USE_MOCK !== 'false'

export async function getStoryView(storyId: number): Promise<StoryView> {
  if (USE_MOCK) {
    // 실제 네트워크처럼 아주 약간의 딜레이를 줘서 로딩 UI도 함께 확인.
    await new Promise(resolve => setTimeout(resolve, 200))
    return { ...MOCK_STORY_VIEW, storyId }
  }

  // ===== 로그인/토큰 인프라 완성 후 활성화 =====
  // const token = localStorage.getItem('accessToken')
  // return apiClient<StoryView>(`/stories/${storyId}/view`, {
  //   method: 'GET',
  //   headers: token ? { Authorization: `Bearer ${token}` } : {},
  // })
  throw new Error('뷰어 실 API 호출은 로그인 구현 후 활성화됩니다. VITE_VIEWER_USE_MOCK 확인 필요.')
}
