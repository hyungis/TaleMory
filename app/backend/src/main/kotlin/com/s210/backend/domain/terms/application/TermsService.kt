package com.s210.backend.domain.terms.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.terms.application.dto.TermsResult
import com.s210.backend.domain.terms.entity.Terms
import com.s210.backend.domain.terms.exception.TermsErrorCode
import com.s210.backend.domain.terms.infrastructure.repository.TermsRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
class TermsService(
    private val termsRepository: TermsRepository,
) {
    fun findTerms(type: String?): List<TermsResult> {
        val terms = type
            ?.trim()
            ?.takeIf(String::isNotBlank)
            ?.let(termsRepository::findAllByTypeIgnoreCaseOrderByIdAsc)
            ?: termsRepository.findAllByOrderByIdAsc()

        if (terms.isEmpty()) {
            throw BusinessException(TermsErrorCode.TERMS_NOT_FOUND)
        }

        return terms.map(Terms::toResult)
    }
}

private fun Terms.toResult(): TermsResult =
    TermsResult(
        termId = id,
        type = type,
        version = version,
        title = title,
        content = content,
        isRequired = isRequired,
        effectiveAt = effectiveAt,
        createdAt = createdAt,
    )
