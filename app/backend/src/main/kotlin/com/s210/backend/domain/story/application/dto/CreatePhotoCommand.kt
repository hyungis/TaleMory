package com.s210.backend.domain.story.application.dto

import java.time.LocalDateTime

/**
 * Step 2 사진 commit(POST /api/stories/{id}/photos) 유스케이스 커맨드.
 *
 * S3 PUT 은 FE 가 presigned URL 로 이미 끝낸 상태에서 이 커맨드가 호출된다.
 * BE 는 s3Key 검증 + DB INSERT 만 담당.
 */
data class CreatePhotoCommand(
    val userId: Long,
    val storyId: Long,
    val s3Key: String,
    val takenAt: LocalDateTime? = null,
    val description: String? = null,
    val tagsJson: String? = null,
)
