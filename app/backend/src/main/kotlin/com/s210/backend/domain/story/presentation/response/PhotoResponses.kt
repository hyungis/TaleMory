package com.s210.backend.domain.story.presentation.response

import com.s210.backend.common.codec.PhotoId
import com.s210.backend.common.codec.StoryId
import com.s210.backend.domain.story.application.dto.PhotoResult
import java.time.Instant
import java.time.LocalDateTime

/**
 * `POST /photos/presigned-url` 응답 — FE 가 브라우저에서 S3 로 직접 PUT 할 URL.
 */
data class PresignPhotoResponse(
    val uploadUrl: String,
    val s3Key: String,
    val expiresAt: Instant,
)

/**
 * `POST /photos` (commit) + `GET /photos` 공통 응답 원소.
 *
 * `imageUrl` 은 presigned GET URL (5분 유효) — 브라우저가 이걸로 `<img src>` 에 바로 쓸 수 있다.
 * private 버킷이라 raw s3Key 만으로는 로드 안 되는 점에 유의.
 */
data class PhotoItemResponse(
    val photoId: PhotoId,
    val storyId: StoryId,
    val imageUrl: String,
    val purpose: String,
    val description: String?,
    val tagsJson: String?,
    val takenAt: LocalDateTime?,
    val displayOrder: Long,
    val createdAt: LocalDateTime,
) {
    companion object {
        fun from(result: PhotoResult, presignedUrl: String): PhotoItemResponse = PhotoItemResponse(
            photoId = PhotoId(result.id),
            storyId = StoryId(result.storyId),
            imageUrl = presignedUrl,
            purpose = result.purpose.name,
            description = result.description,
            tagsJson = result.tagsJson,
            takenAt = result.takenAt,
            displayOrder = result.displayOrder,
            createdAt = result.createdAt,
        )
    }
}
