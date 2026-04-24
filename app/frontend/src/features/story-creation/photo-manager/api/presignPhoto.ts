import { post } from '../../../../shared/api'
import type { PresignPhotoRequest, PresignPhotoResponse } from './types'

/**
 * presigned PUT URL 발급 — 3-phase 업로드의 Phase 1.
 * 받은 uploadUrl 로 FE 가 브라우저에서 S3 에 직접 PUT 후, 반환된 s3Key 를 commit 요청에 포함.
 */
export function presignPhoto(
  storyId: number,
  body: PresignPhotoRequest,
): Promise<PresignPhotoResponse> {
  return post<PresignPhotoResponse>(`/stories/${storyId}/photos/presigned-url`, body)
}
