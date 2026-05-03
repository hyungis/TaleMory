package com.s210.backend.domain.auth.presentation

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.application.MemberService
import com.s210.backend.domain.auth.application.dto.OauthCallbackResult
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.auth.presentation.request.KakaoCallbackRequest
import com.s210.backend.domain.auth.presentation.request.KakaoSignupRequest
import com.s210.backend.domain.auth.presentation.request.LoginRequest
import com.s210.backend.domain.auth.presentation.request.SignupRequest
import com.s210.backend.domain.auth.presentation.response.AuthResponse
import com.s210.backend.domain.auth.presentation.response.KakaoCallbackResponse
import com.s210.backend.domain.auth.presentation.response.RefreshTokenResponse
import com.s210.backend.domain.auth.presentation.response.SignupResponse
import com.s210.backend.domain.auth.presentation.response.toAuthResponse
import com.s210.backend.domain.auth.presentation.response.toKakaoCallbackResponse
import com.s210.backend.domain.auth.presentation.support.RefreshTokenCookieManager
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val memberService: MemberService,
    private val refreshTokenCookieManager: RefreshTokenCookieManager,
) {

    @PostMapping("/signup")
    fun authSignup(@RequestBody request: SignupRequest): ResponseEntity<ApiResponse<SignupResponse>> =
        ResponseEntity.ok(
            ApiResponse(data = SignupResponse(userId = memberService.signUp(request.toCommand()))),
        )

    @PostMapping("/login")
    fun authLogin(
        @RequestBody request: LoginRequest,
        response: HttpServletResponse,
    ): ResponseEntity<ApiResponse<AuthResponse>> {
        val result = memberService.login(request.toCommand())
        refreshTokenCookieManager.addRefreshToken(response, result.refreshToken)

        return ResponseEntity.ok(
            ApiResponse(
                success = true,
                data = result.toAuthResponse(),
            )
        )
    }

    @PostMapping("/kakao/callback")
    fun authKakaoCallback(
        @RequestBody request: KakaoCallbackRequest,
        response: HttpServletResponse,
    ): ResponseEntity<ApiResponse<KakaoCallbackResponse>> {
        val result = memberService.loginWithKakaoCallback(
            code = request.code,
            redirectUri = request.redirectUri,
        )
        if (result is OauthCallbackResult.Login) {
            refreshTokenCookieManager.addRefreshToken(response, result.authResult.refreshToken)
        }

        return ResponseEntity.ok(
            ApiResponse(
                success = true,
                data = result.toKakaoCallbackResponse(),
            )
        )
    }

    @PostMapping("/kakao/signup")
    fun authKakaoSignup(
        @RequestBody request: KakaoSignupRequest,
        response: HttpServletResponse,
    ): ResponseEntity<ApiResponse<AuthResponse>> {
        val result = memberService.signUpWithKakao(request.toCommand())
        refreshTokenCookieManager.addRefreshToken(response, result.refreshToken)

        return ResponseEntity.ok(
            ApiResponse(
                success = true,
                data = result.toAuthResponse(),
            )
        )
    }

    @PostMapping("/refresh")
    fun authRefresh(
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): ResponseEntity<ApiResponse<RefreshTokenResponse>> {
        val refreshToken = refreshTokenCookieManager.resolveRefreshToken(request)
            ?: throw BusinessException(CommonErrorCode.INVALID_REFRESH_TOKEN)

        val result = memberService.validateRefreshTokenAndCreateToken(refreshToken)
        refreshTokenCookieManager.addRefreshToken(response, result.refreshToken)

        return ResponseEntity.ok(
            ApiResponse(
                success = true,
                data = RefreshTokenResponse(accessToken = result.accessToken),
            )
        )
    }

    @PostMapping("/logout")
    fun authLogout(
        @AuthenticationPrincipal user: CustomUser?,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): ResponseEntity<ApiResponse<Unit>> {
        val refreshToken = refreshTokenCookieManager.resolveRefreshToken(request)
        memberService.logout(user?.username, refreshToken)
        refreshTokenCookieManager.expireRefreshToken(response)
        return ResponseEntity.ok(ApiResponse(success = true))
    }
}
