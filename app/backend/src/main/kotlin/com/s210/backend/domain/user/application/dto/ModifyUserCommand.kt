package com.s210.backend.domain.user.application.dto

data class ModifyUserCommand(
    val name: String?,
    val nickname: String?,
    val phone: String?,
    val agreeSms: Boolean?,
    val agreeMarketing: Boolean?,
)
