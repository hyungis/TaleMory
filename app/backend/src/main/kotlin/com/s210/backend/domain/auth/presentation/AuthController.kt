package com.s210.backend.domain.auth.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.presentation.request.LoginRequest
import com.s210.backend.domain.auth.presentation.request.SignupRequest
import com.s210.backend.domain.auth.presentation.response.AuthResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/auth")
class AuthController {

    // 회원가입
    @PostMapping("/signup")
    fun authSignup(@RequestBody request: SignupRequest): ResponseEntity<ApiResponse<Unit>> {
        // TODO: AuthService.signup(command)
        TODO("Not yet implemented")
    }

    // 로그인
    @PostMapping("/login")
    fun authLogin(@RequestBody request: LoginRequest): ResponseEntity<ApiResponse<AuthResponse>> {
        // TODO: AuthService.login(command)
        TODO("Not yet implemented")
    }

    // 토큰 갱신
    @PostMapping("/refresh")
    fun authRefresh(): ResponseEntity<ApiResponse<AuthResponse>> {
        // TODO: AuthService.refresh(refreshToken)
        TODO("Not yet implemented")
    }

    // 로그아웃
    @PostMapping("/logout")
    fun authLogout(): ResponseEntity<ApiResponse<Unit>> {
        // TODO: AuthService.logout()
        TODO("Not yet implemented")
    }

    // OAuth 시작 URL 발급
    @GetMapping("/oauth/{provider}/authorize")
    fun authOauthAuthorize(@PathVariable provider: String): ResponseEntity<ApiResponse<Map<String, String>>> {
        // TODO: AuthService.getOauthAuthorizeUrl(provider)
        TODO("Not yet implemented")
    }
}
