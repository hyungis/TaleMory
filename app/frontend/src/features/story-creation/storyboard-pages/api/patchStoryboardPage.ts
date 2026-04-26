import { patch } from '../../../../shared/api'
import type { UpdateStoryboardPageRequest, UpdateStoryboardPageResponse } from './types'

/**
 * `PATCH /api/stories/{storyId}/storyboard/pages/{pageNumber}` —
 * Step 4 textarea onBlur 시 호출.
 *
 * 한글 본문(`koreanText`)만 갱신한다. 영문본/sceneSummary/imagePrompt 는 AI 원본 그대로 보존.
 */
export function patchStoryboardPage(
  storyId: number,
  pageNumber: number,
  body: UpdateStoryboardPageRequest,
): Promise<UpdateStoryboardPageResponse> {
  return patch<UpdateStoryboardPageResponse>(
    `/stories/${storyId}/storyboard/pages/${pageNumber}`,
    body,
  )
}
