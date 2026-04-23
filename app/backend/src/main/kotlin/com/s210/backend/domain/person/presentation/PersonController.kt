package com.s210.backend.domain.person.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.person.application.PersonService
import com.s210.backend.domain.person.model.PersonRole
import com.s210.backend.domain.person.presentation.request.CreatePersonRequest
import com.s210.backend.domain.person.presentation.request.ModifyPersonRequest
import com.s210.backend.domain.person.presentation.response.PersonResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 인물 (아이/동행자) 프로필 CRUD.
 *
 * 모든 엔드포인트는 JWT 인증 전제 — SecurityConfig 가 persons 경로 전체를 authenticated() 로 보호.
 * 호출자 식별은 `@AuthenticationPrincipal user.userId` 로 서비스에 주입한다.
 */
@RestController
@RequestMapping("/api/persons")
class PersonController(
    private val personService: PersonService,
) {

    /** 인물 목록 조회 (`role` 선택 필터: CHILD / COMPANION). */
    @GetMapping
    fun personList(
        @AuthenticationPrincipal user: CustomUser,
        @RequestParam(required = false) role: String?,
    ): ResponseEntity<ApiResponse<List<PersonResponse>>> {
        val parsedRole = role?.uppercase()?.let(PersonRole::valueOf)
        val results = personService.findPersons(user.userId, parsedRole)
        return ResponseEntity.ok(
            ApiResponse(data = results.map(PersonResponse::from)),
        )
    }

    /** 인물 신규 등록. 성공 시 201 CREATED. */
    @PostMapping
    fun personAdd(
        @AuthenticationPrincipal user: CustomUser,
        @RequestBody @Valid request: CreatePersonRequest,
    ): ResponseEntity<ApiResponse<PersonResponse>> {
        val result = personService.addPerson(user.userId, request.toCommand())
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse(data = PersonResponse.from(result)))
    }

    /** 인물 단건 조회. 다른 유저 리소스면 403. */
    @GetMapping("/{personId}")
    fun personDetails(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable personId: Long,
    ): ResponseEntity<ApiResponse<PersonResponse>> {
        val result = personService.findPerson(user.userId, personId)
        return ResponseEntity.ok(
            ApiResponse(data = PersonResponse.from(result)),
        )
    }

    /** 인물 부분 수정 (이름/생년월일/성별). role 변경은 의도적으로 제외. */
    @PatchMapping("/{personId}")
    fun personModify(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable personId: Long,
        @RequestBody request: ModifyPersonRequest,
    ): ResponseEntity<ApiResponse<PersonResponse>> {
        val result = personService.modifyPerson(user.userId, personId, request.toCommand())
        return ResponseEntity.ok(
            ApiResponse(data = PersonResponse.from(result)),
        )
    }

    /** 인물 소프트 삭제 — `deleted_at` 세팅, 실제 row 는 유지. */
    @DeleteMapping("/{personId}")
    fun personRemove(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable personId: Long,
    ): ResponseEntity<ApiResponse<Unit>> {
        personService.removePerson(user.userId, personId)
        return ResponseEntity.ok(ApiResponse(success = true))
    }
}
