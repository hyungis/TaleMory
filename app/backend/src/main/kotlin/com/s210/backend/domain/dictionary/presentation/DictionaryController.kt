package com.s210.backend.domain.dictionary.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.dictionary.presentation.response.WordResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/dictionary")
class DictionaryController {

    // 단어 번역 조회
    @GetMapping("/words/{word}")
    fun wordDetails(@PathVariable word: String): ResponseEntity<ApiResponse<WordResponse>> {
        // TODO: DictionaryService.findWord(word)
        TODO("Not yet implemented")
    }
}
