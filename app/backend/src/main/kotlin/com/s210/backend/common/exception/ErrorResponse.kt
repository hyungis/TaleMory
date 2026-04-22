package com.s210.backend.common.exception

data class ErrorResponse(
    val success: Boolean = false,
    val code: String,
    val message: String
)
