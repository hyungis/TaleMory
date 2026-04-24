import { post } from '../../../../shared/api'
import type { CreateStoryRequest, StoryCreateResponse } from './types'

/**
 * POST /api/stories — BasicInfoStep 종료 시 1회 호출.
 * DRAFT 상태 stories row 생성 → storyId 만 응답.
 * 이후 step 2~8 의 사진/스토리보드/삽화 등 모든 리소스는 이 storyId 를 FK 로 참조한다.
 */
export function postStory(body: CreateStoryRequest): Promise<StoryCreateResponse> {
  return post<StoryCreateResponse>('/stories', body)
}
