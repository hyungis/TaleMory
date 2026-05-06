import { post } from '../../../../shared/api'
import type { GenerateStoryboardSummaryRequest, StartGenerationResult } from './types'

/**
 * 스토리보드 줄거리(요약) 1차 생성 trigger — `POST /stories/{storyId}/storyboard/summary`.
 *
 * 202 Accepted + `{ jobId, jobType, status }` 반환.
 * 호출부는 응답 jobId 를 가지고 `useStoryboardSummaryQuery` 로 polling 한다.
 */
export function postGenerateStoryboardSummary(
  storyId: number,
  body: GenerateStoryboardSummaryRequest,
): Promise<StartGenerationResult> {
  return post<StartGenerationResult>(`/stories/${storyId}/storyboard/summary`, body)
}
