import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import type { StoryId } from '../../../../shared/types'
import { getPhotos } from '../api/getPhotos'
import type { PhotoItemResponse } from '../api/types'

/**
 * story 의 사진 목록 조회 훅.
 *
 * `storyId` 가 null 이면 자동으로 disabled — BasicInfoStep 에서 POST /stories 끝내고
 * storyId 세팅된 시점부터 활성화.
 *
 * `imageUrl` 이 1시간짜리 presigned URL 이라 `staleTime` 55분으로 잡아 만료 직전 refetch 유도.
 */
export function usePhotosQuery(storyId: StoryId | null): UseQueryResult<PhotoItemResponse[], ApiError> {
  return useQuery<PhotoItemResponse[], ApiError>({
    queryKey: ['photos', storyId],
    queryFn: () => getPhotos(storyId as StoryId),
    enabled: storyId !== null,
    staleTime: 55 * 60 * 1000,
  })
}
