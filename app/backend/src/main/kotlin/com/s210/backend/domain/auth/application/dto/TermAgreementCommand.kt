package com.s210.backend.domain.auth.application.dto

data class TermAgreementCommand(
    val termId: Long,
    val agreed: Boolean,
)
