package com.s210.backend.domain.dictionary.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(
    name = "word_dictionary",
    uniqueConstraints = [UniqueConstraint(name = "uk_word_pos", columnNames = ["word", "pos"])]
)
class WordDictionary(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 100)
    val word: String,

    @Column(length = 20)
    val pos: String? = null,

    @Column(name = "definition_ko", nullable = false, columnDefinition = "TEXT")
    val definitionKo: String,

    @Column(length = 255)
    val ipa: String? = null,

    @Column(columnDefinition = "JSON")
    val forms: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
)
