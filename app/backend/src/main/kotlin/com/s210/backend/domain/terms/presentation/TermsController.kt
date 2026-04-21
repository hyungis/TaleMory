package com.s210.backend.domain.terms.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.terms.presentation.response.TermsResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/terms")
class TermsController {

    // 약관 목록 조회
    @GetMapping
    fun termsList(): ResponseEntity<ApiResponse<List<TermsResponse>>> {
        // TODO: TermsService.findAllTerms()
        TODO("Not yet implemented")
    }
}
