import { post } from '../../../../shared/api/client'
import type { JobId, StoryId } from '../../../../shared/types'

export interface FinalIllustrationRetryResponse {
  jobId: JobId
}

/**
 * Step 8 미리보기에서 FINAL_ILLUSTRATION 잡이 FAILED 인 상태에서 [다시 시도] 클릭 시 호출.
 * `POST /api/stories/{storyId}/jobs/final-illustration/retry`.
 *
 * BE 가 Story.stylePresetId 로 enqueue 재호출 — 멱등 가드가 FAILED/CANCELLED 일 때만 새 잡 발행.
 * 응답의 jobId 로 FE 가 polling 재개.
 */
export async function postFinalIllustrationRetry(
  storyId: StoryId,
): Promise<FinalIllustrationRetryResponse> {
  return post<FinalIllustrationRetryResponse>(
    `/stories/${storyId}/jobs/final-illustration/retry`,
    {},
  )
}
