package com.s210.backend.common.exception

import com.s210.backend.common.response.ApiErrorResponse
import com.s210.backend.common.response.ErrorDetail
import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.security.core.AuthenticationException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {
    private val log = LoggerFactory.getLogger(GlobalExceptionHandler::class.java)

    @ExceptionHandler(BusinessException::class)
    fun handleBusinessException(e: BusinessException): ResponseEntity<ApiErrorResponse> {
        log.warn("BusinessException: code={} message={}", e.errorCode.code, e.errorCode.message)
        return toResponse(e.errorCode)
    }

    /**
     * Spring Security 의 AuthenticationException (BadCredentialsException / UsernameNotFoundException 등)
     * 을 API 명세의 LOGIN_FAILED(401) 로 매핑. 이 핸들러가 없으면 catch-all 로 500 이 떨어져
     * FE 가 "서버 오류" 로 오인하게 된다.
     */
    @ExceptionHandler(AuthenticationException::class)
    fun handleAuthenticationException(e: AuthenticationException): ResponseEntity<ApiErrorResponse> {
        log.warn("Authentication failed: {}", e.message)
        return toResponse(CommonErrorCode.LOGIN_FAILED)
    }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidationException(e: MethodArgumentNotValidException): ResponseEntity<ApiErrorResponse> {
        val message = e.bindingResult.fieldErrors.firstOrNull()?.defaultMessage
            ?: CommonErrorCode.INVALID_INPUT.message
        log.warn("Validation failed: {}", message)

        return ResponseEntity
            .status(CommonErrorCode.INVALID_INPUT.status)
            .body(
                ApiErrorResponse(
                    error = ErrorDetail(
                        code = CommonErrorCode.INVALID_INPUT.code,
                        message = message,
                    ),
                )
            )
    }

    @ExceptionHandler(Exception::class)
    fun handleException(e: Exception): ResponseEntity<ApiErrorResponse> {
        // catch-all — 예상 못 한 예외는 반드시 스택 트레이스 남겨서 추후 분석 가능하게.
        log.error("Unhandled exception reached GlobalExceptionHandler", e)
        return toResponse(CommonErrorCode.INTERNAL_SERVER_ERROR)
    }

    private fun toResponse(errorCode: ErrorCode): ResponseEntity<ApiErrorResponse> {
        return ResponseEntity
            .status(errorCode.status)
            .body(
                ApiErrorResponse(
                    error = ErrorDetail(
                        code = errorCode.code,
                        message = errorCode.message,
                    ),
                )
            )
    }
}
