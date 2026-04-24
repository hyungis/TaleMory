import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { postGenerateStoryboardStory } from '../api/postGenerateStoryboardStory'
import type { GenerateStoryboardStoryRequest, JobStartResponse } from '../api/types'

/**
 * 스토리보드 줄거리 생성 트리거 — `POST /stories/{storyId}/storyboard/story`.
 *
 * 요청 본문 포맷: `{ prompt?: string | null }` (빈 프롬프트 허용).
 * 성공 시 202 Accepted + `{ jobId, jobType, status }` 를 반환하며,
 * 호출부는 `jobId` 를 `useJobQuery` 에 넘겨 상태 polling 을 시작한다.
 */
export function useGenerateStoryboardStoryPost(
  storyId: number | null,
): UseMutationResult<JobStartResponse, ApiError, GenerateStoryboardStoryRequest> {
  return useMutation<JobStartResponse, ApiError, GenerateStoryboardStoryRequest>({
    mutationFn: body => {
      if (storyId === null) {
        // UI 가드 누락 시 서버 호출 전에 막는다.
        throw new Error('storyId 가 아직 없습니다. Step 1 저장 후 생성 가능합니다.')
      }
      return postGenerateStoryboardStory(storyId, body)
    },
  })
}
