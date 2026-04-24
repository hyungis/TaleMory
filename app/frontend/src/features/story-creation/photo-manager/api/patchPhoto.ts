import { patch } from '../../../../shared/api'
import type { ModifyPhotoRequest, PhotoItemResponse } from './types'

/**
 * 사진 설명/태그 수정.
 * 응답의 `imageUrl` 은 **새로 발급된** presigned GET URL (BE 가 매번 재발급).
 */
export function patchPhoto(
  storyId: number,
  photoId: number,
  body: ModifyPhotoRequest,
): Promise<PhotoItemResponse> {
  return patch<PhotoItemResponse>(`/stories/${storyId}/photos/${photoId}`, body)
}
