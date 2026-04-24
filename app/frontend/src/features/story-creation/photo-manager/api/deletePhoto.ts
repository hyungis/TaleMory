import { deleteRequest } from '../../../../shared/api'

/**
 * 사진 soft delete. S3 객체는 즉시 삭제하지 않고 DB `deleted_at` 만 기록.
 */
export function deletePhoto(storyId: number, photoId: number): Promise<void> {
  return deleteRequest<void>(`/stories/${storyId}/photos/${photoId}`)
}
