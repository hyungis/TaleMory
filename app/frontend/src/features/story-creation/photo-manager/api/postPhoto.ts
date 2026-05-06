import { post } from '../../../../shared/api'
import type { CreatePhotoRequest, PhotoItemResponse } from './types'

/**
 * S3 업로드 완료 후 DB commit — 3-phase 업로드의 Phase 3.
 * BE 가 s3Key prefix 검증 + photo_album_items INSERT 후, presigned GET URL 포함 응답을 돌려줌.
 */
export function postPhoto(
  storyId: number,
  body: CreatePhotoRequest,
): Promise<PhotoItemResponse> {
  return post<PhotoItemResponse>(`/stories/${storyId}/photos`, body)
}
