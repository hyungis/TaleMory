package com.s210.backend.domain.user.application.dto

import java.time.LocalDateTime

data class UserResult(
    val id: Long,
    val loginId: String?,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String?,
    val agreePrivacy: Boolean,
    val agreeServiceTerms: Boolean,
    val onboardingCompleted: Boolean,
    val provider: String?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
)
