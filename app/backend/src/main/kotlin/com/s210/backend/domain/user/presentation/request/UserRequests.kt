package com.s210.backend.domain.user.presentation.request

import com.s210.backend.domain.user.application.dto.ModifyUserCommand

data class ModifyUserRequest(
    val name: String?,
    val nickname: String?,
    val phone: String?,
    val agreePrivacy: Boolean?,
    val agreeServiceTerms: Boolean?,
) {
    fun toCommand(): ModifyUserCommand = ModifyUserCommand(
        name = name,
        nickname = nickname,
        phone = phone,
        agreePrivacy = agreePrivacy,
        agreeServiceTerms = agreeServiceTerms,
    )
}
