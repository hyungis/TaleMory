package com.s210.backend.domain.auth.presentation

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.application.MemberService
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.auth.presentation.request.LoginRequest
import com.s210.backend.domain.auth.presentation.request.SignupRequest
import com.s210.backend.domain.auth.presentation.response.AuthResponse
import com.s210.backend.domain.auth.presentation.response.RefreshTokenResponse
import com.s210.backend.domain.auth.presentation.response.toAuthResponse
import com.s210.backend.domain.auth.presentation.support.OauthCallbackRedirectBuilder
import com.s210.backend.domain.auth.presentation.support.RefreshTokenCookieManager
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val memberService: MemberService,
    private val refreshTokenCookieManager: RefreshTokenCookieManager,
    private val oauthCallbackRedirectBuilder: OauthCallbackRedirectBuilder,
) {

    @PostMapping("/signup")
    fun authSignup(@RequestBody request: SignupRequest): ResponseEntity<ApiResponse<Unit>> {
        return ResponseEntity.ok(memberService.signUp(request.toCommand()))
    }

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
        @AuthenticationPrincipal user: CustomUser,
        response: HttpServletResponse,
    ): ResponseEntity<ApiResponse<Unit>> {
        memberService.deleteAllRefreshToken(user.username)
        refreshTokenCookieManager.expireRefreshToken(response)
        return ResponseEntity.ok(ApiResponse(success = true))
    }

    @GetMapping("/oauth/{provider}/authorize")
    fun authOauthAuthorize(@PathVariable provider: String): ResponseEntity<Void> {
        return try {
            val authorizeUrl = memberService.getOauthAuthorizeUrl(provider)

            ResponseEntity.status(HttpStatus.FOUND)
                .header("Location", authorizeUrl)
                .build()
        } catch (exception: BusinessException) {
            ResponseEntity.status(HttpStatus.FOUND)
                .location(oauthCallbackRedirectBuilder.buildFailureRedirect(exception.message ?: "카카오 로그인에 실패했어요."))
                .build()
        }
    }

    @GetMapping("/oauth/{provider}/callback")
    fun authOauthCallback(
        @PathVariable provider: String,
        @RequestParam(required = false) code: String?,
        @RequestParam(required = false) error: String?,
        @RequestParam(name = "error_description", required = false) errorDescription: String?,
        response: HttpServletResponse,
    ): ResponseEntity<Void> {
        if (error != null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                .location(oauthCallbackRedirectBuilder.buildFailureRedirect(errorDescription ?: "카카오 인증이 취소되었어요."))
                .build()
        }

        if (code.isNullOrBlank()) {
            return ResponseEntity.status(HttpStatus.FOUND)
                .location(oauthCallbackRedirectBuilder.buildFailureRedirect(CommonErrorCode.INVALID_INPUT.message))
                .build()
        }

        return try {
            val result = memberService.loginWithOauthCallback(provider, code)
            refreshTokenCookieManager.addRefreshToken(response, result.refreshToken)

            ResponseEntity.status(HttpStatus.FOUND)
                .location(oauthCallbackRedirectBuilder.buildSuccessRedirect(result.toAuthResponse()))
                .build()
        } catch (exception: BusinessException) {
            ResponseEntity.status(HttpStatus.FOUND)
                .location(oauthCallbackRedirectBuilder.buildFailureRedirect(exception.message ?: "카카오 로그인에 실패했어요."))
                .build()
        }
    }
}
