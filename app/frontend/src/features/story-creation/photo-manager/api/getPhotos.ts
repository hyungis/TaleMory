import { get } from '../../../../shared/api'
import type { PhotoItemResponse } from './types'

/**
 * Story 의 사진 목록 조회.
 * 각 사진의 `imageUrl` 은 5분 유효 presigned GET URL — 만료되면 다시 조회 필요.
 * (React Query 의 staleTime/refetchInterval 로 자동 갱신 가능.)
 */
export function getPhotos(storyId: number): Promise<PhotoItemResponse[]> {
  return get<PhotoItemResponse[]>(`/stories/${storyId}/photos`)
}
