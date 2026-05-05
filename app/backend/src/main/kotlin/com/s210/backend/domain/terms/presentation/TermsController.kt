package com.s210.backend.domain.terms.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.terms.application.TermsService
import com.s210.backend.domain.terms.presentation.response.TermsResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/terms")
class TermsController(
    private val termsService: TermsService,
) {

    // 약관 목록 조회
    @GetMapping
    fun termsList(
        @RequestParam(required = false) type: String?,
    ): ResponseEntity<ApiResponse<List<TermsResponse>>> =
        ResponseEntity.ok(
            ApiResponse(data = termsService.findTerms(type).map(TermsResponse::from)),
        )
}
