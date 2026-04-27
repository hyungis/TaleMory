package com.s210.backend.domain.user.presentation.request

import com.s210.backend.domain.user.application.dto.ModifyUserCommand

data class ModifyUserRequest(
    val name: String?,
    val nickname: String?,
    val phone: String?,
    val agreeSms: Boolean?,
    val agreeMarketing: Boolean?,
) {
    fun toCommand(): ModifyUserCommand = ModifyUserCommand(
        name = name,
        nickname = nickname,
        phone = phone,
        agreeSms = agreeSms,
        agreeMarketing = agreeMarketing,
    )
}
