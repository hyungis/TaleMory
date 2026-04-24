import { patch } from '../../../../shared/api'
import type { ModifyStoryRequest, StoryCreateResponse } from './types'

/**
 * PATCH /api/stories/{id} — BasicInfoStep 에서 뒤로가기 후 값 수정 → 재클릭 시 호출.
 * 서버는 null 필드를 "미변경" 으로 취급하고, 응답은 POST 와 동일한 `{ storyId }` 형태.
 */
export function patchStory(id: number, body: ModifyStoryRequest): Promise<StoryCreateResponse> {
  return patch<StoryCreateResponse>(`/stories/${id}`, body)
}
