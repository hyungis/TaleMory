package com.s210.backend.domain.user.presentation.response

import com.s210.backend.domain.user.application.dto.UserResult
import java.time.LocalDateTime

data class UserResponse(
    val userId: Long,
    val loginId: String?,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String?,
    val agreeSms: Boolean,
    val agreeMarketing: Boolean,
    val onboardingCompleted: Boolean,
    val provider: String?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
) {
    companion object {
        fun from(result: UserResult): UserResponse = UserResponse(
            userId = result.id,
            loginId = result.loginId,
            email = result.email,
            name = result.name,
            nickname = result.nickname,
            phone = result.phone,
            agreeSms = result.agreeSms,
            agreeMarketing = result.agreeMarketing,
            onboardingCompleted = result.onboardingCompleted,
            provider = result.provider,
            createdAt = result.createdAt,
            updatedAt = result.updatedAt,
        )
    }
}
