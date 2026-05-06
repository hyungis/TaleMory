package com.s210.backend.domain.story.application.dto

/**
 * PATCH /api/stories/{storyId}/photos/{photoId} 유스케이스 커맨드.
 *
 * `description` / `tagsJson` 둘 다 optional — null 은 "미변경", 빈 문자열 은 "값 비우기" 로 해석.
 * (현재 UI 는 빈 문자열로 비우기 지원. 필드 자체를 "미변경" 으로 두려면 FE 가 필드를 omit 하면 됨.)
 */
data class ModifyPhotoCommand(
    val userId: Long,
    val storyId: Long,
    val photoId: Long,
    val description: String? = null,
    val tagsJson: String? = null,
)
