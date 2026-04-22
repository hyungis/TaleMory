package com.s210.backend.domain.person.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.person.presentation.request.CreatePersonRequest
import com.s210.backend.domain.person.presentation.request.ModifyPersonRequest
import com.s210.backend.domain.person.presentation.response.PersonResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/persons")
class PersonController {

    // 인물 목록 조회 (query: role=child/companion)
    @GetMapping
    fun personList(@RequestParam(required = false) role: String?): ResponseEntity<ApiResponse<List<PersonResponse>>> {
        // TODO: PersonService.findPersons(userId, role)
        TODO("Not yet implemented")
    }

    // 인물 등록
    @PostMapping
    fun personAdd(@RequestBody request: CreatePersonRequest): ResponseEntity<ApiResponse<PersonResponse>> {
        // TODO: PersonService.addPerson(userId, command)
        TODO("Not yet implemented")
    }

    // 인물 상세 조회
    @GetMapping("/{personId}")
    fun personDetails(@PathVariable personId: Long): ResponseEntity<ApiResponse<PersonResponse>> {
        // TODO: PersonService.findPerson(personId)
        TODO("Not yet implemented")
    }

    // 인물 수정
    @PatchMapping("/{personId}")
    fun personModify(
        @PathVariable personId: Long,
        @RequestBody request: ModifyPersonRequest
    ): ResponseEntity<ApiResponse<PersonResponse>> {
        // TODO: PersonService.modifyPerson(personId, command)
        TODO("Not yet implemented")
    }

    // 인물 삭제
    @DeleteMapping("/{personId}")
    fun personRemove(@PathVariable personId: Long): ResponseEntity<ApiResponse<Unit>> {
        // TODO: PersonService.removePerson(personId)
        TODO("Not yet implemented")
    }
}
