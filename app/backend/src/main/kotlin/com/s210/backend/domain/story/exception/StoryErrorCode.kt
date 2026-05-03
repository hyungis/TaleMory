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
    STORY_ACCESS_FORBIDDEN(HttpStatus.FORBIDDEN, "STORY_005", "해당 동화에 접근할 권한이 없습니다."),
    INVALID_STORY_STATE(HttpStatus.CONFLICT, "STORY_006", "현재 상태에서는 수행할 수 없습니다."),
    STYLE_PRESET_NOT_FOUND(HttpStatus.NOT_FOUND, "STORY_007", "존재하지 않는 삽화 스타일입니다."),
    SENTENCE_NOT_FOUND(HttpStatus.NOT_FOUND, "STORY_008", "문장을 찾을 수 없습니다."),
    HIGHLIGHT_VOICE_NOT_FOUND(HttpStatus.NOT_FOUND, "STORY_009", "강조 녹음을 찾을 수 없습니다."),
    SUMMARY_REQUIRED(HttpStatus.BAD_REQUEST, "STORY_010", "줄거리(요약) 생성을 먼저 완료해야 합니다."),
    SUMMARY_NOT_FOUND(HttpStatus.NOT_FOUND, "STORY_011", "재생성할 직전 줄거리(요약)가 없습니다."),
    STORY_ALREADY_IN_PROGRESS(HttpStatus.CONFLICT, "STORY_012", "본문 생성이 이미 진행 중입니다."),
    ROLLBACK_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "STORY_013", "삽화 롤백을 사용할 수 없습니다."),
    NOTHING_TO_ROLLBACK(HttpStatus.BAD_REQUEST, "STORY_014", "되돌릴 이전 버전이 없습니다."),
    REGENERATION_LIMIT_EXCEEDED(HttpStatus.BAD_REQUEST, "STORY_015", "삽화 재생성 횟수를 초과했습니다."),
    BGM_PRESET_NOT_FOUND(HttpStatus.NOT_FOUND, "STORY_016", "존재하지 않는 BGM 프리셋입니다."),
    SCENE_NOT_FOUND(HttpStatus.NOT_FOUND, "STORY_017", "씬을 찾을 수 없습니다."),
    STORYBOARD_REGEN_LIMIT_EXCEEDED(HttpStatus.BAD_REQUEST, "STORY_018", "스토리보드 페이지 이미지 재생성은 동화당 3회까지 가능합니다."),
    CHARACTER_PHOTOS_REQUIRED(HttpStatus.BAD_REQUEST, "STORY_019", "대표 사진을 1장 이상 선택해주세요."),
    MAX_CHARACTER_PHOTOS_EXCEEDED(HttpStatus.BAD_REQUEST, "STORY_020", "대표 사진은 최대 3장까지 선택할 수 있습니다."),
    CHARACTER_PHOTOS_LOCKED(HttpStatus.CONFLICT, "STORY_021", "스토리보드 생성이 시작되어 대표 사진을 변경할 수 없습니다."),
    STEP_LOCKED_BY_SUMMARY(HttpStatus.CONFLICT, "STORY_022", "본문(줄거리)이 이미 생성되어 변경할 수 없습니다."),
    STORYBOARD_IMAGES_NOT_READY(HttpStatus.CONFLICT, "STORY_023", "스토리보드 이미지가 아직 모두 준비되지 않았습니다."),
}
