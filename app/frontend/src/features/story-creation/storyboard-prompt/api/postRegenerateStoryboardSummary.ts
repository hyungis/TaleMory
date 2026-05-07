import { post } from '../../../../shared/api'
import type { RegenerateStoryboardSummaryRequest, StartGenerationResult } from './types'
import type { StoryId } from '../../../../shared/types'

/**
 * 스토리보드 줄거리(요약) 자연어 재생성 — `POST /stories/{storyId}/storyboard/summary/regenerate`.
 *
 * 직전 SUCCESS 줄거리가 있어야 호출 가능 (없으면 BE 가 STORY_011 SUMMARY_NOT_FOUND).
 * 202 Accepted + `{ jobId, jobType, status }` 반환.
 */
export function postRegenerateStoryboardSummary(
  storyId: StoryId,
  body: RegenerateStoryboardSummaryRequest,
): Promise<StartGenerationResult> {
  return post<StartGenerationResult>(`/stories/${storyId}/storyboard/summary/regenerate`, body)
}
