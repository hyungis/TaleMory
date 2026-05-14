import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import type { StoryId } from '../../../../shared/types'
import {
  postFinalIllustrationRetry,
  type FinalIllustrationRetryResponse,
} from '../api/postFinalIllustrationRetry'

/**
 * 최종 삽화 잡 재시도 mutation — `POST /api/stories/{storyId}/jobs/final-illustration/retry`.
 *
 * Step 8 FinalPreviewStep 에서 FAILED 상태일 때 [다시 시도] 버튼 클릭 시 사용.
 * 성공 시 응답의 jobId 로 setFinalIllustrationJobId → polling 재개.
 */
export function useFinalIllustrationRetry(): UseMutationResult<
  FinalIllustrationRetryResponse,
  ApiError,
  StoryId
> {
  return useMutation<FinalIllustrationRetryResponse, ApiError, StoryId>({
    mutationFn: storyId => postFinalIllustrationRetry(storyId),
  })
}
