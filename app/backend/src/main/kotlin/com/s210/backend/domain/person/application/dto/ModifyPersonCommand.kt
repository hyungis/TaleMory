package com.s210.backend.domain.person.application.dto

import com.s210.backend.domain.person.model.Gender

data class ModifyPersonCommand(
    val name: String?,
    val age: Int?,
    val gender: Gender?
)
