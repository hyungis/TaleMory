package com.s210.backend.domain.terms.exception

import com.s210.backend.common.exception.ErrorCode
import org.springframework.http.HttpStatus

enum class TermsErrorCode(
    override val status: HttpStatus,
    override val code: String,
    override val message: String,
) : ErrorCode {
    TERMS_NOT_FOUND(HttpStatus.NOT_FOUND, "TERMS_001", "약관 정보를 찾을 수 없습니다."),
    REQUIRED_TERMS_NOT_CONFIGURED(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "TERMS_002",
        "필수 약관이 설정되어 있지 않습니다.",
    ),
    REQUIRED_TERMS_NOT_AGREED(HttpStatus.BAD_REQUEST, "TERMS_003", "필수 약관에 모두 동의해야 합니다."),
}
