package com.s210.backend.domain.user.presentation.response

import java.time.LocalDateTime

data class UserResponse(
    val id: Long,
    val loginId: String?,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String?,
    val agreeSms: Boolean,
    val agreeMarketing: Boolean,
    val createdAt: LocalDateTime
)
