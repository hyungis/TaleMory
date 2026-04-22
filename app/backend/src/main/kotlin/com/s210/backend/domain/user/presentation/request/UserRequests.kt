package com.s210.backend.domain.user.presentation.request

data class ModifyUserRequest(
    val nickname: String?,
    val phone: String?,
    val agreeSms: Boolean?,
    val agreeMarketing: Boolean?
)
