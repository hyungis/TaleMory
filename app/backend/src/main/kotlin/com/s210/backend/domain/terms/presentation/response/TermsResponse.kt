package com.s210.backend.domain.terms.presentation.response

import com.fasterxml.jackson.annotation.JsonProperty
import com.s210.backend.domain.terms.application.dto.TermsResult
import java.time.LocalDateTime

data class TermsResponse(
    val termId: Long,
    val type: String,
    val version: Int,
    val title: String,
    val content: String,
    @get:JsonProperty("isRequired")
    val isRequired: Boolean,
    val effectiveAt: LocalDateTime,
    val createdAt: LocalDateTime,
) {
    companion object {
        fun from(result: TermsResult): TermsResponse =
            TermsResponse(
                termId = result.termId,
                type = result.type,
                version = result.version,
                title = result.title,
                content = result.content,
                isRequired = result.isRequired,
                effectiveAt = result.effectiveAt,
                createdAt = result.createdAt,
            )
    }
}
