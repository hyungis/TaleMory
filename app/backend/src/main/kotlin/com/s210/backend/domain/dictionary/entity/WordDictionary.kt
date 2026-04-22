package com.s210.backend.domain.dictionary.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "word_dictionary")
class WordDictionary(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 100, unique = true)
    val word: String,

    @Column(length = 20)
    val pos: String? = null,

    @Column(name = "meaning_json", nullable = false, columnDefinition = "JSON")
    val meaningJson: String,

    @Column(length = 255)
    val pronunciation: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
)
