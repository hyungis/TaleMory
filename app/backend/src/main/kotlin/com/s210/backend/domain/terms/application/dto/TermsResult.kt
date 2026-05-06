package com.s210.backend.domain.terms.application.dto

import java.time.LocalDateTime

data class TermsResult(
    val termId: Long,
    val type: String,
    val version: Int,
    val title: String,
    val content: String,
    val isRequired: Boolean,
    val effectiveAt: LocalDateTime,
    val createdAt: LocalDateTime,
)
