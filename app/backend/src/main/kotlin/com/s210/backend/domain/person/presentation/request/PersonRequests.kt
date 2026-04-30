package com.s210.backend.domain.person.presentation.request

import com.s210.backend.domain.person.application.dto.CreatePersonCommand
import com.s210.backend.domain.person.application.dto.ModifyPersonCommand
import com.s210.backend.domain.person.model.Gender
import com.s210.backend.domain.person.model.PersonRole
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull

/**
 * 신규 인물 등록 요청.
 * - `age` 는 0..150 범위 정수 (FE 가 입력한 만 나이 그대로 보존).
 * - `gender` / `role` 은 대소문자 무관하게 enum 매핑.
 */
data class CreatePersonRequest(
    @field:NotBlank val name: String,
    @field:NotNull
    @field:Min(value = 0, message = "나이는 0 이상이어야 합니다.")
    @field:Max(value = 150, message = "나이는 150 이하여야 합니다.")
    val age: Int?,
    @field:NotBlank val gender: String,
    @field:NotBlank val role: String,
) {
    fun toCommand(): CreatePersonCommand = CreatePersonCommand(
        name = name,
        age = age ?: 0,
        gender = Gender.valueOf(gender.uppercase()),
        role = PersonRole.valueOf(role.uppercase()),
    )
}

/** 인물 수정 요청. 모든 필드 nullable — 전달된 값만 부분 업데이트. */
data class ModifyPersonRequest(
    val name: String?,
    @field:Min(value = 0, message = "나이는 0 이상이어야 합니다.")
    @field:Max(value = 150, message = "나이는 150 이하여야 합니다.")
    val age: Int?,
    val gender: String?,
) {
    fun toCommand(): ModifyPersonCommand = ModifyPersonCommand(
        name = name,
        age = age,
        gender = gender?.let { Gender.valueOf(it.uppercase()) },
    )
}
