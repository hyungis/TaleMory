package com.s210.backend.domain.dictionary.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.dictionary.application.DictionaryService
import com.s210.backend.domain.dictionary.presentation.response.WordResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/dictionary")
class DictionaryController(
    private val dictionaryService: DictionaryService,
) {

    @GetMapping("/words/{word}")
    fun wordDetails(@PathVariable word: String): ResponseEntity<ApiResponse<List<WordResponse>>> {
        val results = dictionaryService.findWord(word)
        val response = results.map {
            WordResponse(
                word = it.word,
                pos = it.pos,
                definitionKo = it.definitionKo,
                ipa = it.ipa,
                forms = it.forms,
            )
        }
        return ResponseEntity.ok(ApiResponse(data = response))
    }
}
