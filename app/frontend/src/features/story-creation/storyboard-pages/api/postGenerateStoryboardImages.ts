import { post } from '../../../../shared/api'
import type { JobStartResponse } from './types'

/**
 * `POST /api/stories/{storyId}/storyboard/images` — 페이지 N장 이미지 배치 생성.
 *
 * 비동기 (202 Accepted). 응답의 jobId 로 `/generation-jobs/{jobId}` 폴링 →
 * 페이지별 image_url 이 storyboard_pages 에 채워짐.
 */
export function postGenerateStoryboardImages(storyId: number): Promise<JobStartResponse> {
  return post<JobStartResponse>(`/stories/${storyId}/storyboard/images`, {})
}
