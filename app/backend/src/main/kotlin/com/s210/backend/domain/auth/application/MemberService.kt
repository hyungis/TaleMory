package com.s210.backend.domain.auth.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.ErrorCode
import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.application.dto.AuthResult
import com.s210.backend.domain.auth.application.dto.LoginCommand
import com.s210.backend.domain.auth.application.dto.SignupCommand
import com.s210.backend.common.entity.TokenInfo
import com.s210.backend.common.jwt.JwtTokenProvider
import com.s210.backend.common.jwt.RefreshTokenInfoRepositoryRedis
import com.s210.backend.domain.auth.infrastructure.repository.MemberRepository
import com.s210.backend.domain.auth.presentation.response.AuthResponse
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
    /**
     * 회원가입
     */
    fun signUp(command: SignupCommand): ApiResponse<Unit> {
        // ID 중복 검사
        if (memberRepository.existsByLoginId(command.loginId)) {
            throw BusinessException(ErrorCode.DUPLICATE_LOGIN_ID)
        }
        if (memberRepository.existsByEmail(command.email)) {
            throw BusinessException(ErrorCode.DUPLICATE_EMAIL)
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

    /**
     * 로그인 -> 토큰 발행
     */
    fun login(command: LoginCommand): AuthResult {
        val authenticationToken = UsernamePasswordAuthenticationToken(command.loginId, command.password)
        val authentication = authenticationManager.authenticate(authenticationToken)
        val tokenInfo: TokenInfo = jwtTokenProvider.createToken(authentication)

        refreshTokenInfoRepositoryRedis.save(command.loginId, tokenInfo.refreshToken)

        val user = memberRepository.findByLoginId(command.loginId) ?:
        throw BusinessException(ErrorCode.USER_NOT_FOUND)


        return AuthResult(tokenInfo.grantType, tokenInfo.accessToken, tokenInfo.refreshToken, user)
    }//컨트롤 어드바이스로

    /**
     * 유저의 모든 Refresh 토큰 삭제
     */
    fun deleteAllRefreshToken(loginId: String) {
        refreshTokenInfoRepositoryRedis.deleteByUserId(loginId)
    }

    /**
     * Refresh 토큰 검증 후 토큰 재발급
     */
    fun validateRefreshTokenAndCreateToken(refreshToken: String): ApiResponse<AuthResponse> {
        // Redis에 refreshToken 유효 여부 확인
        refreshTokenInfoRepositoryRedis.findByRefreshToken(refreshToken)
            ?: throw BusinessException(ErrorCode.INVALID_REFRESH_TOKEN)

        // 새로운 accessToken, refreshToken 발급
        val newTokenInfo: TokenInfo = jwtTokenProvider.validateRefreshTokenAndCreateToken(refreshToken)

        // 기존 refreshToken Redis에서 제거 : refreshToken은 1회용
        refreshTokenInfoRepositoryRedis.deleteByRefreshToken(refreshToken)

        // 새로운 refreshToken Redis에 추가
        refreshTokenInfoRepositoryRedis.save(newTokenInfo.userId, newTokenInfo.refreshToken)
        return ApiResponse(
            success = true,
            data = null,
            message = newTokenInfo.accessToken,
        )
    }
}