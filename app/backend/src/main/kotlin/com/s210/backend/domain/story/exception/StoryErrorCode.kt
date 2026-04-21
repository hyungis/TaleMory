package com.s210.backend.domain.story.exception

import com.s210.backend.common.exception.ErrorCode
import org.springframework.http.HttpStatus

enum class StoryErrorCode(
    override val status: HttpStatus,
    override val code: String,
    override val message: String
) : ErrorCode {
    STORY_NOT_FOUND(HttpStatus.NOT_FOUND, "STORY_001", "스토리를 찾을 수 없습니다."),
    STORY_GENERATION_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "STORY_002", "스토리 생성에 실패했습니다."),
    INVALID_PHOTO_FORMAT(HttpStatus.BAD_REQUEST, "STORY_003", "지원하지 않는 이미지 형식입니다."),
    PHOTO_UPLOAD_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "STORY_004", "사진 업로드에 실패했습니다."),
}
