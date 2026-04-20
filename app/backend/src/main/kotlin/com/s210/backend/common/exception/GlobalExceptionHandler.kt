package com.s210.backend.common.exception

import com.s210.backend.common.response.ApiErrorResponse
import com.s210.backend.common.response.ErrorDetail
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.HttpRequestMethodNotSupportedException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {

    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(BusinessException::class)
    fun handleBusinessException(e: BusinessException): ResponseEntity<ApiErrorResponse> {
        log.warn("BusinessException: {} - {}", e.errorCode.code, e.errorCode.message)
        return ResponseEntity
            .status(e.errorCode.status)
            .body(ApiErrorResponse(error = ErrorDetail(e.errorCode.code, e.errorCode.message)))
    }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidationException(e: MethodArgumentNotValidException): ResponseEntity<ApiErrorResponse> {
        val message = e.bindingResult.fieldErrors
            .joinToString(", ") { "${it.field}: ${it.defaultMessage}" }
        log.warn("Validation failed: {}", message)
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(ApiErrorResponse(error = ErrorDetail(CommonErrorCode.INVALID_INPUT.code, message)))
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException::class)
    fun handleMethodNotSupported(e: HttpRequestMethodNotSupportedException): ResponseEntity<ApiErrorResponse> {
        return ResponseEntity
            .status(HttpStatus.METHOD_NOT_ALLOWED)
            .body(ApiErrorResponse(error = ErrorDetail(CommonErrorCode.METHOD_NOT_ALLOWED.code, e.message ?: CommonErrorCode.METHOD_NOT_ALLOWED.message)))
    }

    @ExceptionHandler(Exception::class)
    fun handleException(e: Exception): ResponseEntity<ApiErrorResponse> {
        log.error("Unhandled exception", e)
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiErrorResponse(error = ErrorDetail(CommonErrorCode.INTERNAL_SERVER_ERROR.code, CommonErrorCode.INTERNAL_SERVER_ERROR.message)))
    }
}
