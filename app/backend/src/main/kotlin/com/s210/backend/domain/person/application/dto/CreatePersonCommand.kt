package com.s210.backend.domain.person.application.dto

import com.s210.backend.domain.person.model.Gender
import com.s210.backend.domain.person.model.PersonRole
import java.time.LocalDate

data class CreatePersonCommand(
    val name: String,
    val birthDate: LocalDate,
    val gender: Gender,
    val role: PersonRole
)
