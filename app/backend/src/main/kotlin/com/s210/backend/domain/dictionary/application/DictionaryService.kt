package com.s210.backend.domain.dictionary.application

import com.s210.backend.domain.dictionary.application.dto.WordResult
import com.s210.backend.domain.dictionary.infrastructure.repository.WordDictionaryRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
class DictionaryService(
    private val wordDictionaryRepository: WordDictionaryRepository,
) {
    fun findWord(word: String): List<WordResult> {
        return wordDictionaryRepository.findAllByWord(word.lowercase())
            .map {
                WordResult(
                    word = it.word,
                    pos = it.pos,
                    definitionKo = it.definitionKo,
                    ipa = it.ipa,
                    forms = it.forms,
                )
            }
    }
}
