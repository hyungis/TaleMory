import { get } from '../../../../shared/api'
import type { StoryDraftResponse } from './types'

/**
 * GET /api/stories/draft — 로그인 유저의 최신 DRAFT 동화 1건 조회.
 * DRAFT 가 없으면 서버가 `{ success: true, data: null }` 로 내려주므로 `null` 반환.
 * 호출처: BookstoreScene "새 동화책 만들기" 클릭 직후 이어서 작성 여부를 판단.
 */
export function getDraftStory(): Promise<StoryDraftResponse | null> {
  return get<StoryDraftResponse | null>('/stories/draft')
}
