package com.s210.backend.domain.terms.presentation.response

import java.time.LocalDateTime

data class TermsResponse(
    val id: Long,
    val type: String,
    val version: Int,
    val title: String,
    val content: String,
    val isRequired: Boolean,
    val effectiveAt: LocalDateTime
)
