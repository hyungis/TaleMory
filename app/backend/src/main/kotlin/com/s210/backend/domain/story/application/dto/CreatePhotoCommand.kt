package com.s210.backend.domain.story.application.dto

import com.s210.backend.domain.story.model.PhotoPurpose
import java.time.LocalDateTime

/**
 * Step 2 사진 commit(POST /api/stories/{id}/photos) 유스케이스 커맨드.
 *
 * S3 PUT 은 FE 가 presigned URL 로 이미 끝낸 상태에서 이 커맨드가 호출된다.
 * BE 는 s3Key 검증 + DB INSERT 만 담당.
 *
 * `purpose` 는 두 가지 입력 경로를 구분한다:
 *  - `STORYBOARD` (default) — 추억 사진 zone 업로드. 스토리 본문 베이스로 사용.
 *  - `CHARACTER_REF` — "대표 사진" 별도 업로드. AI reference 전용 (스토리 본문엔 X).
 *  `BOTH` 는 commit 단계에선 허용하지 않음 — 별 토글 (PUT character-ref-toggle) 로만 도달.
 */
data class CreatePhotoCommand(
    val userId: Long,
    val storyId: Long,
    val s3Key: String,
    val purpose: PhotoPurpose = PhotoPurpose.STORYBOARD,
    val takenAt: LocalDateTime? = null,
    val description: String? = null,
    val tagsJson: String? = null,
)
