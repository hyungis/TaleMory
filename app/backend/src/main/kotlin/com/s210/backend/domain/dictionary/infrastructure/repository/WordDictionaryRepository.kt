package com.s210.backend.domain.dictionary.infrastructure.repository

import com.s210.backend.domain.dictionary.entity.WordDictionary
import org.springframework.data.jpa.repository.JpaRepository
interface WordDictionaryRepository : JpaRepository<WordDictionary, Long> {
    fun findAllByWord(word: String): List<WordDictionary>
}
