import { put } from '../../../../shared/api'
import type { PhotoItemResponse } from './types'

/**
 * PUT /api/stories/{id}/photos/order — 사진 순서 일괄 변경.
 * `photoIds` 는 현재 story 의 활성 사진 전체를 새 순서대로 나열한 리스트.
 * 응답은 재정렬된 전체 목록 (presigned GET URL 포함).
 */
export function orderPhotos(
  storyId: number,
  photoIds: number[],
): Promise<PhotoItemResponse[]> {
  return put<PhotoItemResponse[]>(`/stories/${storyId}/photos/order`, { photoIds })
}
