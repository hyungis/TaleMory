package com.s210.backend.common.response

data class ApiErrorResponse(
    val success: Boolean = false,
    val error: ErrorDetail
)

data class ErrorDetail(
    val code: String,
    val message: String
)
