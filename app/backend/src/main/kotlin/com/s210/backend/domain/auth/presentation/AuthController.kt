package com.s210.backend.domain.auth.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.application.dto.CustomUser
import com.s210.backend.domain.auth.application.MemberService
import com.s210.backend.domain.auth.application.dto.LoginCommand
import com.s210.backend.domain.auth.application.dto.SignupCommand
import com.s210.backend.domain.auth.presentation.request.LoginRequest
import com.s210.backend.domain.auth.presentation.request.SignupRequest
import com.s210.backend.domain.auth.presentation.request.TokenRefreshRequest
import com.s210.backend.domain.auth.presentation.response.AuthResponse
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/auth")
class AuthController(
    private val memberService: MemberService,
) {

    // 회원가입
    @PostMapping("/signup")
    fun authSignup(@RequestBody request: SignupRequest): ResponseEntity<ApiResponse<Unit>> {

        return ResponseEntity.ok(
            memberService.signUp(
                    SignupCommand(
                        loginId = request.loginId,
                        password = request.password,
                        email = request.email,
                        name = request.name,
                        nickname = request.nickname,
                        phone = request.phone,
                        agreeSms = request.agreeSms,
                        agreeMarketing = request.agreeMarketing,
                    )
                )
        )
    }

    // 로그인
    @PostMapping("/login")
    fun authLogin(@RequestBody request: LoginRequest): ResponseEntity<ApiResponse<AuthResponse>> {
        val result = memberService.login(
            LoginCommand(
                loginId = request.loginId,
                password = request.password,
            )
        )
        return ResponseEntity.ok(
            ApiResponse(
                success = true,
                data = AuthResponse(
                    accessToken = result.accessToken,
                    refreshToken = result.refreshToken,
                    user = result.user
                ),
            )
        )
    }

    // 토큰 갱신
    @PostMapping("/refresh")
    fun authRefresh(@RequestBody request: TokenRefreshRequest): ResponseEntity<String> {
        val result = memberService.validateRefreshTokenAndCreateToken(request.refreshToken)
        return ResponseEntity.ok(result )
    }

    // 로그아웃
    @PostMapping("/logout")
    fun authLogout(@AuthenticationPrincipal user: CustomUser): ResponseEntity<ApiResponse<Unit>> {
        memberService.deleteAllRefreshToken(user.username)
        return ResponseEntity.ok(ApiResponse(success = true))
    }

    // OAuth 시작 URL 발급
    @GetMapping("/oauth/{provider}/authorize")
    fun authOauthAuthorize(@PathVariable provider: String): ResponseEntity<ApiResponse<Map<String, String>>> {
        // TODO: AuthService.getOauthAuthorizeUrl(provider)
        TODO("Not yet implemented")
    }
}
