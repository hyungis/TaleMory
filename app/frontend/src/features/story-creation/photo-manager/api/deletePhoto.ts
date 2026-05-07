import { deleteRequest } from '../../../../shared/api'
import type { PhotoId, StoryId } from '../../../../shared/types'

/**
 * 사진 soft delete. S3 객체는 즉시 삭제하지 않고 DB `deleted_at` 만 기록.
 */
export function deletePhoto(storyId: StoryId, photoId: PhotoId): Promise<void> {
  return deleteRequest<void>(`/stories/${storyId}/photos/${photoId}`)
}
