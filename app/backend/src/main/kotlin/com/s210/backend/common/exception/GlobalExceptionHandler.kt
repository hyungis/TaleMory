package com.s210.backend.common.exception

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException::class)
    fun handleBusinessException(e: BusinessException): ResponseEntity<ErrorResponse> {
        return toResponse(e.errorCode)
    }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidationException(e: MethodArgumentNotValidException): ResponseEntity<ErrorResponse> {
        val message = e.bindingResult.fieldErrors.firstOrNull()?.defaultMessage
            ?: CommonErrorCode.INVALID_INPUT.message

        return ResponseEntity
            .status(CommonErrorCode.INVALID_INPUT.status)
            .body(
                ErrorResponse(
                    code = CommonErrorCode.INVALID_INPUT.code,
                    message = message
                )
            )
    }

    @ExceptionHandler(Exception::class)
    fun handleException(e: Exception): ResponseEntity<ErrorResponse> {
        return toResponse(CommonErrorCode.INTERNAL_SERVER_ERROR)
    }

    private fun toResponse(errorCode: ErrorCode): ResponseEntity<ErrorResponse> {
        return ResponseEntity
            .status(errorCode.status)
            .body(
                ErrorResponse(
                    code = errorCode.code,
                    message = errorCode.message
                )
            )
    }
}