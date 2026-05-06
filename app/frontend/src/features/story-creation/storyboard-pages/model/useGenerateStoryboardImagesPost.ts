import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { postGenerateStoryboardImages } from '../api/postGenerateStoryboardImages'
import type { JobStartResponse } from '../api/types'

/**
 * 페이지 이미지 배치 생성 시작 mutation.
 *
 * - storyId null 이면 mutate 시점에 throw (UI 가 disable 로 1차 방어).
 * - 응답의 jobId 로 호출부에서 `useGenerationJobQuery(jobId)` 폴링 시작.
 * - 폴링 도중 storyboard_pages.image_url 이 페이지마다 채워지므로,
 *   호출부는 적절한 시점에 `['storyboard-pages', storyId]` 캐시 invalidate 도 수행.
 */
export function useGenerateStoryboardImagesPost(
  storyId: number | null,
): UseMutationResult<JobStartResponse, ApiError, void> {
  return useMutation<JobStartResponse, ApiError, void>({
    mutationFn: () => {
      if (storyId === null) throw new Error('storyId 가 없습니다.')
      return postGenerateStoryboardImages(storyId)
    },
  })
}
