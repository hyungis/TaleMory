package com.s210.backend.domain.person.presentation.response

import com.s210.backend.domain.person.application.dto.PersonResult
import java.time.LocalDate

data class PersonResponse(
    val id: Long,
    val name: String,
    val birthDate: LocalDate,
    val gender: String,
    val role: String,
) {
    companion object {
        /** result → response 매핑. enum → name 문자열 (FE 가 "CHILD"/"FEMALE" 등 그대로 사용). */
        fun from(result: PersonResult): PersonResponse = PersonResponse(
            id = result.id,
            name = result.name,
            birthDate = result.birthDate,
            gender = result.gender.name,
            role = result.role.name,
        )
    }
}
