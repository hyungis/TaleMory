package com.s210.backend.domain.terms.infrastructure.repository

import com.s210.backend.domain.terms.entity.Terms
import org.springframework.data.jpa.repository.JpaRepository

interface TermsRepository : JpaRepository<Terms, Long> {
    fun findAllByOrderByIdAsc(): List<Terms>

    fun findAllByTypeIgnoreCaseOrderByIdAsc(type: String): List<Terms>

    fun findAllByIsRequiredTrueOrderByIdAsc(): List<Terms>
}
