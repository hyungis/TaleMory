package com.s210.backend.domain.person.application.dto

import com.s210.backend.domain.person.model.Gender
import java.time.LocalDate

data class ModifyPersonCommand(
    val name: String?,
    val birthDate: LocalDate?,
    val gender: Gender?
)
