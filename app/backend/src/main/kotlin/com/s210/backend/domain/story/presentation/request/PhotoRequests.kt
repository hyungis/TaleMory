package com.s210.backend.domain.story.presentation.request

import com.s210.backend.domain.story.application.dto.CreatePhotoCommand
import com.s210.backend.domain.story.application.dto.ModifyPhotoCommand
import com.s210.backend.domain.story.model.PhotoPurpose
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Pattern
import java.time.LocalDateTime

/**
 * Step 2 사진 업로드 — presigned PUT URL 발급 요청.
 * FE 는 사용자가 선택한 파일의 MIME 타입만 알려주면 됨.
 *
 * `purpose` (선택) — `STORYBOARD` (기본, 추억 사진 zone) 또는 `CHARACTER_REF` (대표 사진 별도 업로드).
 * `BOTH` 는 거부 — 그건 별 토글로만 도달 가능.
 */
data class PresignPhotoRequest(
    @field:NotBlank
    @field:Pattern(
        regexp = "^image/(jpeg|jpg|png|webp|gif)$",
        message = "지원하지 않는 이미지 형식입니다."
    )
    val contentType: String,
    val purpose: PhotoPurpose? = null,
)

/**
 * Step 2 사진 업로드 — commit 요청.
 * S3 PUT 이 끝난 뒤 FE 가 `s3Key` 를 보내면 BE 가 DB row 생성.
 * `description` / `tagsJson` / `takenAt` 은 나중에 PATCH 로도 추가 가능 (optional).
 *
 * `purpose` (선택) — `STORYBOARD` (기본) 또는 `CHARACTER_REF`. `BOTH` 는 거부.
 */
data class CreatePhotoRequest(
    @field:NotBlank val s3Key: String,
    val purpose: PhotoPurpose? = null,
    val takenAt: LocalDateTime? = null,
    val description: String? = null,
    val tagsJson: String? = null,
) {
    fun toCommand(userId: Long, storyId: Long): CreatePhotoCommand = CreatePhotoCommand(
        userId = userId,
        storyId = storyId,
        s3Key = s3Key,
        purpose = purpose ?: PhotoPurpose.STORYBOARD,
        takenAt = takenAt,
        description = description,
        tagsJson = tagsJson,
    )
}

/**
 * PUT /api/stories/{storyId}/photos/{photoId}/character-ref-toggle — 별 토글.
 *
 *  - `on=true` : purpose `STORYBOARD` → `BOTH` (해당 추억 사진을 reference 로도 사용)
 *  - `on=false`: purpose `BOTH` → `STORYBOARD` (해제)
 *
 * 별도 업로드된 `CHARACTER_REF` 사진은 토글 대상이 아니다 (자체적으로 reference 전용).
 */
data class CharacterRefToggleRequest(
    @field:NotNull
    val on: Boolean? = null,
)

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
