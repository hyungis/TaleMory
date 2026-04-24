package com.s210.backend.domain.story.application.dto

import com.s210.backend.domain.story.entity.PhotoAlbumItem
import com.s210.backend.domain.story.model.PhotoPurpose
import java.time.LocalDateTime

/**
 * Photo 도메인 조회/생성 결과 공통 payload.
 *
 * NOTE: `imageUrl` 필드는 **DB 에 저장된 s3Key** 를 그대로 담는다.
 * presentation layer 가 이 key → presigned GET URL 로 변환해 FE 에 내려준다.
 * (private 버킷이라 raw key 로는 이미지를 볼 수 없음.)
 */
data class PhotoResult(
    val id: Long,
    val storyId: Long,
    val s3Key: String,
    val purpose: PhotoPurpose,
    val description: String?,
    val tagsJson: String?,
    val takenAt: LocalDateTime?,
    val displayOrder: Long,
    val createdAt: LocalDateTime,
) {
    companion object {
        fun from(entity: PhotoAlbumItem): PhotoResult = PhotoResult(
            id = entity.id,
            storyId = entity.storyId,
            s3Key = entity.imageUrl,
            purpose = entity.purpose,
            description = entity.description,
            tagsJson = entity.tagsJson,
            takenAt = entity.takenAt,
            displayOrder = entity.displayOrder,
            createdAt = entity.createdAt,
        )
    }
}
