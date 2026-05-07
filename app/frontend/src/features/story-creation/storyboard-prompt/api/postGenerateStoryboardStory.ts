import { post } from '../../../../shared/api'
import type { GenerateStoryboardStoryRequest, JobStartResponse } from './types'
import type { StoryId } from '../../../../shared/types'

/**
 * 명세 #28 — 스토리보드 줄거리 생성 요청.
 * 202 Accepted + `{ jobId, jobType, status }` 반환.
 *
 * 실제 생성은 비동기. FE 는 응답의 `jobId` 로 `GET /api/generation-jobs/{jobId}` 를 polling.
 */
export function postGenerateStoryboardStory(
  storyId: StoryId,
  body: GenerateStoryboardStoryRequest,
): Promise<JobStartResponse> {
  return post<JobStartResponse>(`/stories/${storyId}/storyboard/story`, body)
}
