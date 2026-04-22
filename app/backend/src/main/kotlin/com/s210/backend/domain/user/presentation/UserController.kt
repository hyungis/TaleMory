package com.s210.backend.domain.user.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.user.presentation.request.ModifyUserRequest
import com.s210.backend.domain.user.presentation.response.UserResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/me")
class UserController {

    // 사용자 정보 조회
    @GetMapping
    fun userDetails(): ResponseEntity<ApiResponse<UserResponse>> {
        // TODO: UserService.findUser(userId)
        TODO("Not yet implemented")
    }

    // 사용자 정보 수정
    @PatchMapping
    fun userModify(@RequestBody request: ModifyUserRequest): ResponseEntity<ApiResponse<UserResponse>> {
        // TODO: UserService.modifyUser(userId, command)
        TODO("Not yet implemented")
    }

    // 사용자 탈퇴
    @DeleteMapping
    fun userRemove(): ResponseEntity<ApiResponse<Unit>> {
        // TODO: UserService.removeUser(userId)
        TODO("Not yet implemented")
    }
}
