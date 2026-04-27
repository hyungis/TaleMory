import { get } from '../../../../shared/api'
import type { StoryboardPagesResponse } from './types'

/**
 * 스토리보드 페이지 list 조회.
 *
 * 줄거리 생성 직후 listener 가 페이지별 row 를 채우면 그대로 보임.
 * 미생성 상태에서도 200 + `{ pages: [] }` 로 응답하므로 FE 는 placeholder 분기만 하면 된다.
 */
export function getStoryboardPages(storyId: number): Promise<StoryboardPagesResponse> {
  return get<StoryboardPagesResponse>(`/stories/${storyId}/storyboard/pages`)
}
