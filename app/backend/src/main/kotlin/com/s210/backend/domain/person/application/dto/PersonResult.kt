package com.s210.backend.domain.person.application.dto

import com.s210.backend.domain.person.model.Gender
import com.s210.backend.domain.person.model.PersonRole
import java.time.LocalDate
import java.time.LocalDateTime

data class PersonResult(
    val id: Long,
    val name: String,
    val birthDate: LocalDate,
    val gender: Gender,
    val role: PersonRole,
    val createdAt: LocalDateTime
)
