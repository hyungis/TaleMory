package com.s210.backend.domain.user.application.dto

data class ModifyUserCommand(
    val name: String?,
    val nickname: String?,
    val phone: String?,
    val agreePrivacy: Boolean?,
    val agreeServiceTerms: Boolean?,
)
