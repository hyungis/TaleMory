package com.s210.backend.domain.auth.application

import com.s210.backend.common.entity.TokenInfo
import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.jwt.JwtTokenProvider
import com.s210.backend.common.jwt.RefreshTokenInfoRepositoryRedis
import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.application.dto.AuthResult
import com.s210.backend.domain.auth.application.dto.LoginCommand
import com.s210.backend.domain.auth.application.dto.SignupCommand
import com.s210.backend.domain.auth.infrastructure.repository.MemberRepository
import com.s210.backend.domain.user.entity.User
import jakarta.transaction.Transactional
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service

@Transactional
@Service
class MemberService(
    private val memberRepository: MemberRepository,
    private val jwtTokenProvider: JwtTokenProvider,
    private val passwordEncoder: PasswordEncoder,
    private val refreshTokenInfoRepositoryRedis: RefreshTokenInfoRepositoryRedis,
    private val authenticationManager: AuthenticationManager,
) {
    fun signUp(command: SignupCommand): ApiResponse<Unit> {
        if (memberRepository.existsByLoginId(command.loginId)) {
            throw BusinessException(CommonErrorCode.DUPLICATE_LOGIN_ID)
        }
        if (memberRepository.existsByEmail(command.email)) {
            throw BusinessException(CommonErrorCode.DUPLICATE_EMAIL)
        }

        val id = memberRepository.save(
            User(
                loginId = command.loginId,
                passwordHash = passwordEncoder.encode(command.password),
                email = command.email,
                name = command.name,
                nickname = command.nickname,
                phone = command.phone,
                agreeSms = command.agreeSms,
                agreeMarketing = command.agreeMarketing,
            )
        ).id

        return ApiResponse(
            success = true,
            data = null,
            message = id.toString(),
        )
    }

    fun login(command: LoginCommand): AuthResult {
        val authenticationToken = UsernamePasswordAuthenticationToken(command.loginId, command.password)
        val authentication = authenticationManager.authenticate(authenticationToken)
        val tokenInfo: TokenInfo = jwtTokenProvider.createToken(authentication)

        refreshTokenInfoRepositoryRedis.save(command.loginId, tokenInfo.refreshToken)

        val user = memberRepository.findByLoginId(command.loginId)
            ?: throw BusinessException(CommonErrorCode.USER_NOT_FOUND)

        return AuthResult(tokenInfo.grantType, tokenInfo.accessToken, tokenInfo.refreshToken, user)
    }

    fun deleteAllRefreshToken(loginId: String) {
        refreshTokenInfoRepositoryRedis.deleteByUserId(loginId)
    }

    fun validateRefreshTokenAndCreateToken(refreshToken: String): TokenInfo {
        refreshTokenInfoRepositoryRedis.findByRefreshToken(refreshToken)
            ?: throw BusinessException(CommonErrorCode.INVALID_REFRESH_TOKEN)

        val newTokenInfo = jwtTokenProvider.validateRefreshTokenAndCreateToken(refreshToken)

        // refresh token 은 1회용으로 운용하고, 재발급 직후 이전 토큰을 폐기한다.
        refreshTokenInfoRepositoryRedis.deleteByRefreshToken(refreshToken)
        refreshTokenInfoRepositoryRedis.save(newTokenInfo.userId, newTokenInfo.refreshToken)

        return newTokenInfo
    }
}
