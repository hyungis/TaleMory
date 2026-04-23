import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { getPhotos } from '../api/getPhotos'
import type { PhotoItemResponse } from '../api/types'

/**
 * story 의 사진 목록 조회 훅.
 *
 * `storyId` 가 null 이면 자동으로 disabled — BasicInfoStep 에서 POST /stories 끝내고
 * storyId 세팅된 시점부터 활성화.
 *
 * `imageUrl` 이 5분짜리 presigned URL 이라 `staleTime` 4분으로 잡아 그 이내엔 재요청 없음.
 */
export function usePhotosQuery(storyId: number | null): UseQueryResult<PhotoItemResponse[], ApiError> {
  return useQuery<PhotoItemResponse[], ApiError>({
    queryKey: ['photos', storyId],
    queryFn: () => getPhotos(storyId as number),
    enabled: storyId !== null,
    staleTime: 4 * 60 * 1000,
  })
}
