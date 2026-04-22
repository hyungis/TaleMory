package com.s210.backend.domain.person.presentation.response

import java.time.LocalDate

data class PersonResponse(
    val id: Long,
    val name: String,
    val birthDate: LocalDate,
    val gender: String,
    val role: String
)
