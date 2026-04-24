package com.s210.backend.domain.story.presentation.request

import com.s210.backend.domain.story.application.dto.CreatePhotoCommand
import com.s210.backend.domain.story.application.dto.ModifyPhotoCommand
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Pattern
import java.time.LocalDateTime

/**
 * Step 2 사진 업로드 — presigned PUT URL 발급 요청.
 * FE 는 사용자가 선택한 파일의 MIME 타입만 알려주면 됨.
 */
data class PresignPhotoRequest(
    @field:NotBlank
    @field:Pattern(
        regexp = "^image/(jpeg|jpg|png|webp|gif)$",
        message = "지원하지 않는 이미지 형식입니다."
    )
    val contentType: String,
)

/**
 * Step 2 사진 업로드 — commit 요청.
 * S3 PUT 이 끝난 뒤 FE 가 `s3Key` 를 보내면 BE 가 DB row 생성.
 * `description` / `tagsJson` / `takenAt` 은 나중에 PATCH 로도 추가 가능 (optional).
 */
data class CreatePhotoRequest(
    @field:NotBlank val s3Key: String,
    val takenAt: LocalDateTime? = null,
    val description: String? = null,
    val tagsJson: String? = null,
) {
    fun toCommand(userId: Long, storyId: Long): CreatePhotoCommand = CreatePhotoCommand(
        userId = userId,
        storyId = storyId,
        s3Key = s3Key,
        takenAt = takenAt,
        description = description,
        tagsJson = tagsJson,
    )
}

/**
 * PATCH /api/stories/{storyId}/photos/{photoId} — 사진 설명/태그 수정.
 * null 필드는 "미변경" 으로 해석. 빈 문자열 은 "값 비우기" 로 해석.
 */
data class ModifyPhotoRequest(
    val description: String? = null,
    val tagsJson: String? = null,
) {
    fun toCommand(userId: Long, storyId: Long, photoId: Long): ModifyPhotoCommand =
        ModifyPhotoCommand(
            userId = userId,
            storyId = storyId,
            photoId = photoId,
            description = description,
            tagsJson = tagsJson,
        )
}

/**
 * PUT /api/stories/{storyId}/photos/order — 사진 순서 일괄 변경.
 * `photoIds` 는 현재 story 의 활성 사진 전체를 새 순서대로 나열한 리스트.
 * 누락/중복/외래 photoId 포함 시 400.
 */
data class PhotoOrderRequest(
    @field:NotEmpty(message = "photoIds 는 비어있을 수 없습니다.")
    val photoIds: List<Long> = emptyList(),
)
