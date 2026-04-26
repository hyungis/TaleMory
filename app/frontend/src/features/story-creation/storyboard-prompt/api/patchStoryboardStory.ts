import { patch } from '../../../../shared/api'
import type { StoryBoardSnapshot, UpdateStoryboardStoryRequest } from './types'

/**
 * 명세 #29 — 유저가 편집한 스토리(줄거리) 저장.
 *
 * FE 의 Step 3 result textarea 의 onBlur 시 호출된다. 동기 응답으로
 * DB 에 반영된 snapshot 을 돌려주며, 호출부는 이를 toast/상태 동기화에 활용한다.
 */
export function patchStoryboardStory(
  storyId: number,
  body: UpdateStoryboardStoryRequest,
): Promise<StoryBoardSnapshot> {
  return patch<StoryBoardSnapshot>(`/stories/${storyId}/storyboard/story`, body)
}
