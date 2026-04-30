package com.s210.backend.domain.person.application.dto

import com.s210.backend.domain.person.model.Gender
import com.s210.backend.domain.person.model.PersonRole

data class CreatePersonCommand(
    val name: String,
    val age: Int,
    val gender: Gender,
    val role: PersonRole
)
