import { post } from '../../../../shared/api'
import type { JobStartResponse, RegenerateStoryboardImageRequest } from './types'

/**
 * `POST /api/stories/{storyId}/storyboard/pages/{pageNumber}/image/regenerate` —
 * 페이지 1장 이미지 재생성.
 *
 * userPrompt 는 NotBlank — 호출부에서 trim + 빈 검증.
 */
export function postRegenerateStoryboardImage(
  storyId: number,
  pageNumber: number,
  body: RegenerateStoryboardImageRequest,
): Promise<JobStartResponse> {
  return post<JobStartResponse>(
    `/stories/${storyId}/storyboard/pages/${pageNumber}/image/regenerate`,
    body,
  )
}
