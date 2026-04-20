package com.s210.backend.domain.person.presentation.request

data class CreatePersonRequest(
    val name: String,
    val birthDate: String,
    val gender: String,
    val role: String
)

data class ModifyPersonRequest(
    val name: String?,
    val birthDate: String?,
    val gender: String?
)
