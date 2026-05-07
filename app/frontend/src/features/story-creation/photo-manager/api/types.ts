/**
 * Step 2 사진 업로드 API 계약 — BE DTO 와 1:1 정합.
 */
import type { PhotoId, StoryId } from '../../../../shared/types'

export type PhotoPurposeApi = 'CHARACTER_REF' | 'STORYBOARD' | 'BOTH'

/**
 * 업로드 시 지정 가능한 purpose. `BOTH` 는 BE 가 거부 — 토글 endpoint 로만 도달.
 *  - `STORYBOARD` (default): 추억 사진 zone 업로드.
 *  - `CHARACTER_REF`: 대표 사진 별도 업로드 zone.
 */
export type UploadablePhotoPurpose = 'STORYBOARD' | 'CHARACTER_REF'

/** `POST /api/stories/{id}/photos/presigned-url` request. */
export interface PresignPhotoRequest {
  contentType: string
  purpose?: UploadablePhotoPurpose
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
  purpose?: UploadablePhotoPurpose
  /** ISO-8601 LocalDateTime. EXIF 의 DateTimeOriginal. 없으면 null/omit. */
  takenAt?: string | null
  description?: string | null
  tagsJson?: string | null
}

/**
 * `PUT /api/stories/{id}/photos/{photoId}/character-ref-toggle` request.
 *  - `on=true`  : 추억 사진 카드의 별 토글 ON  (purpose `STORYBOARD` → `BOTH`)
 *  - `on=false` : 별 토글 OFF (purpose `BOTH` → `STORYBOARD`)
 *
 * `purpose === 'CHARACTER_REF'` 인 별도 업로드 사진은 토글 대상이 아님 — BE 가 거부.
 */
export interface CharacterRefToggleRequest {
  on: boolean
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
  photoId: PhotoId
  storyId: StoryId
  imageUrl: string
  purpose: PhotoPurposeApi
  description: string | null
  tagsJson: string | null
  takenAt: string | null
  displayOrder: number
  createdAt: string
}
