package com.s210.backend.domain.terms.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "terms")
class Terms(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 50)
    val type: String,

    @Column(nullable = false)
    val version: Int,

    @Column(nullable = false, length = 200)
    val title: String,

    @Column(nullable = false, columnDefinition = "MEDIUMTEXT")
    val content: String,

    @Column(name = "is_required", nullable = false)
    val isRequired: Boolean = false,

    @Column(name = "effective_at", nullable = false)
    val effectiveAt: LocalDateTime,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
)
