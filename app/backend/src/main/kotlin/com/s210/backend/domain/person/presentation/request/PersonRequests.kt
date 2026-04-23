package com.s210.backend.domain.person.presentation.request

import com.s210.backend.domain.person.application.dto.CreatePersonCommand
import com.s210.backend.domain.person.application.dto.ModifyPersonCommand
import com.s210.backend.domain.person.model.Gender
import com.s210.backend.domain.person.model.PersonRole
import jakarta.validation.constraints.NotBlank
import java.time.LocalDate

/**
 * 신규 인물 등록 요청.
 * - `birthDate` 는 ISO-8601 문자열 ("2018-03-15") — `LocalDate.parse` 로 안전 변환
 * - `gender` / `role` 은 대소문자 무관하게 enum 매핑 (FE 가 어느 포맷이든 받기 편하게)
 */
data class CreatePersonRequest(
    @field:NotBlank val name: String,
    @field:NotBlank val birthDate: String,
    @field:NotBlank val gender: String,
    @field:NotBlank val role: String,
) {
    fun toCommand(): CreatePersonCommand = CreatePersonCommand(
        name = name,
        birthDate = LocalDate.parse(birthDate),
        gender = Gender.valueOf(gender.uppercase()),
        role = PersonRole.valueOf(role.uppercase()),
    )
}

/** 인물 수정 요청. 모든 필드 nullable — 전달된 값만 부분 업데이트. */
data class ModifyPersonRequest(
    val name: String?,
    val birthDate: String?,
    val gender: String?,
) {
    fun toCommand(): ModifyPersonCommand = ModifyPersonCommand(
        name = name,
        birthDate = birthDate?.let(LocalDate::parse),
        gender = gender?.let { Gender.valueOf(it.uppercase()) },
    )
}
