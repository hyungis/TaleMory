package com.s210.backend.domain.voice.exception

import com.s210.backend.common.exception.ErrorCode
import org.springframework.http.HttpStatus

enum class VoiceErrorCode(
    override val status: HttpStatus,
    override val code: String,
    override val message: String,
) : ErrorCode {
    VOICE_PROFILE_NOT_FOUND(HttpStatus.NOT_FOUND, "VOICE_000", "보이스 프로필을 찾을 수 없습니다."),
    VOICE_CLONE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "VOICE_001", "보이스 클론에 실패했습니다."),
    TTS_GENERATION_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "VOICE_002", "TTS 생성에 실패했습니다."),
    INVALID_AUDIO_FORMAT(HttpStatus.BAD_REQUEST, "VOICE_003", "지원하지 않는 오디오 형식입니다."),
}
