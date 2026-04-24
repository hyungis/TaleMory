/**
 * Step 2 사진 업로드 API 계약 — BE DTO 와 1:1 정합.
 */

export type PhotoPurposeApi = 'CHARACTER_REF' | 'STORYBOARD' | 'BOTH'

/** `POST /api/stories/{id}/photos/presigned-url` request. */
export interface PresignPhotoRequest {
  contentType: string
}

/** presigned PUT URL 발급 응답. FE 는 uploadUrl 로 S3 에 직접 PUT, s3Key 는 commit 때 다시 보냄. */
export interface PresignPhotoResponse {
  uploadUrl: string
  s3Key: string
  /** ISO-8601 Instant. 보통 5분 후. */
  expiresAt: string
}

/** `POST /api/stories/{id}/photos` (commit) request. */
export interface CreatePhotoRequest {
  s3Key: string
  /** ISO-8601 LocalDateTime. EXIF 의 DateTimeOriginal. 없으면 null/omit. */
  takenAt?: string | null
  description?: string | null
  tagsJson?: string | null
}

/**
 * `PATCH /api/stories/{id}/photos/{photoId}` request.
 * null 또는 omit 필드는 "미변경", 빈 문자열은 "값 비우기" 로 해석됨.
 */
export interface ModifyPhotoRequest {
  description?: string | null
  tagsJson?: string | null
}

/**
 * `GET` 목록 / `POST` commit 공통 응답 원소.
 * `imageUrl` 은 presigned GET URL — 브라우저가 `<img src>` 로 바로 로드 가능 (유효 5분).
 */
export interface PhotoItemResponse {
  photoId: number
  storyId: number
  imageUrl: string
  purpose: PhotoPurposeApi
  description: string | null
  tagsJson: string | null
  takenAt: string | null
  displayOrder: number
  createdAt: string
}
