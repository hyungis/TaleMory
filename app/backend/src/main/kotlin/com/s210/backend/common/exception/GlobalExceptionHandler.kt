package com.s210.backend.common.exception

import com.s210.backend.common.response.ApiErrorResponse
import com.s210.backend.common.response.ErrorDetail
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException::class)
    fun handleBusinessException(e: BusinessException): ResponseEntity<ApiErrorResponse> {
        return toResponse(e.errorCode)
    }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidationException(e: MethodArgumentNotValidException): ResponseEntity<ApiErrorResponse> {
        val message = e.bindingResult.fieldErrors.firstOrNull()?.defaultMessage
            ?: CommonErrorCode.INVALID_INPUT.message

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
