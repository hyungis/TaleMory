package com.s210.backend.domain.person.presentation.response

import com.s210.backend.common.codec.PersonId
import com.s210.backend.domain.person.application.dto.PersonResult

data class PersonResponse(
    val id: PersonId,
    val name: String,
    val age: Int,
    val gender: String,
    val role: String,
) {
    companion object {
        /** result → response 매핑. enum → name 문자열 (FE 가 "CHILD"/"FEMALE" 등 그대로 사용). */
        fun from(result: PersonResult): PersonResponse = PersonResponse(
            id = PersonId(result.id),
            name = result.name,
            age = result.age,
            gender = result.gender.name,
            role = result.role.name,
        )
    }
}
