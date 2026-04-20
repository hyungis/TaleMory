package com.s210.backend.domain.dictionary.infrastructure.repository

import com.s210.backend.domain.dictionary.entity.WordDictionary
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface WordDictionaryRepository : JpaRepository<WordDictionary, Long> {
    fun findByWord(word: String): Optional<WordDictionary>
}
