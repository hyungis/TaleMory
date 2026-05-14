package com.s210.backend.domain.user.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.auth.presentation.support.RefreshTokenCookieManager
import com.s210.backend.domain.user.application.UserService
import com.s210.backend.domain.user.presentation.request.ModifyUserRequest
import com.s210.backend.domain.user.presentation.response.UserResponse
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/me")
class UserController(
    private val userService: UserService,
    private val refreshTokenCookieManager: RefreshTokenCookieManager,
) {

    @GetMapping
    fun userDetails(
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<UserResponse>> =
        ResponseEntity.ok(
            ApiResponse(data = UserResponse.from(userService.findUser(user.userId))),
        )

    @PatchMapping
    fun userModify(
        @AuthenticationPrincipal user: CustomUser,
        @RequestBody request: ModifyUserRequest,
    ): ResponseEntity<ApiResponse<UserResponse>> =
        ResponseEntity.ok(
            ApiResponse(data = UserResponse.from(userService.modifyUser(user.userId, request.toCommand()))),
        )

    @PatchMapping("/onboarding-completion")
    fun userOnboardingComplete(
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<Void> {
        userService.modifyUserOnboardingCompleted(user.userId)
        return ResponseEntity.noContent().build()
    }

    @DeleteMapping
    fun userRemove(
        @AuthenticationPrincipal user: CustomUser,
        response: HttpServletResponse,
    ): ResponseEntity<Void> {
        userService.removeUser(user.userId, user.username)
        refreshTokenCookieManager.expireRefreshToken(response)
        return ResponseEntity.noContent().build()
    }
}
