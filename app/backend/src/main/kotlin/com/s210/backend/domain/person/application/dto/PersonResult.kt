package com.s210.backend.domain.person.application.dto

import com.s210.backend.domain.person.entity.Person
import com.s210.backend.domain.person.model.Gender
import com.s210.backend.domain.person.model.PersonRole
import java.time.LocalDateTime

data class PersonResult(
    val id: Long,
    val name: String,
    val age: Int,
    val gender: Gender,
    val role: PersonRole,
    val createdAt: LocalDateTime,
) {
    companion object {
        fun from(person: Person): PersonResult = PersonResult(
            id = person.id,
            name = person.name,
            age = person.age,
            gender = person.gender,
            role = person.role,
            createdAt = person.createdAt,
        )
    }
}
