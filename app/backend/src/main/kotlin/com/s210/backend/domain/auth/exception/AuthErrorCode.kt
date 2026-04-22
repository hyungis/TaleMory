package com.s210.backend.domain.auth.exception

import com.s210.backend.common.exception.ErrorCode
import org.springframework.http.HttpStatus

enum class AuthErrorCode(
    override val status: HttpStatus,
    override val code: String,
    override val message: String
) : ErrorCode {
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "AUTH_001", "아이디 또는 비밀번호가 올바르지 않습니다."),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "AUTH_002", "토큰이 만료되었습니다."),
    TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "AUTH_003", "유효하지 않은 토큰입니다."),
    OAUTH_FAILED(HttpStatus.BAD_REQUEST, "AUTH_004", "OAuth 인증에 실패했습니다."),
    ALREADY_REGISTERED(HttpStatus.CONFLICT, "AUTH_005", "이미 가입된 사용자입니다."),
}
