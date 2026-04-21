package com.s210.backend.domain.auth.application

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.application.dto.AuthResult
import com.s210.backend.domain.auth.application.dto.LoginCommand
import com.s210.backend.domain.auth.application.dto.SignupCommand
import com.s210.backend.domain.auth.application.dto.TokenInfo
import com.s210.backend.domain.auth.infrastructure.JwtTokenProvider
import com.s210.backend.domain.auth.infrastructure.RefreshTokenInfoRepositoryRedis
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
    /**
     * 회원가입
     */
    fun signUp(command: SignupCommand): ApiResponse<Unit> {
        // ID 중복 검사
        if (memberRepository.existsByLoginId(command.loginId)) {
            return ApiResponse(
                success = false,
                data = null,
                message = "이미 등록된 id 입니다.",
            )
        }
        if (memberRepository.existsByEmail(command.email)) {
            return ApiResponse(
                success = false,
                data = null,
                message = "이미 등록된 이메일 입니다.",
            )
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

        val user = memberRepository.findByLoginId(command.loginId) ?:throw RuntimeException("사용자를 찾을 수 없습니다")


        return AuthResult(tokenInfo.grantType, tokenInfo.accessToken, tokenInfo.refreshToken, user)
    }

    /**
     * 유저의 모든 Refresh 토큰 삭제
     */
    fun deleteAllRefreshToken(loginId: String) {
        refreshTokenInfoRepositoryRedis.deleteByUserId(loginId)
    }

    /**
     * Refresh 토큰 검증 후 토큰 재발급
     */
    fun validateRefreshTokenAndCreateToken(refreshToken: String): String {
        // Redis에 refreshToken 유효 여부 확인
        refreshTokenInfoRepositoryRedis.findByRefreshToken(refreshToken)
            ?: throw IllegalArgumentException("만료되거나 찾을 수 없는 Refresh 토큰입니다. 재로그인이 필요합니다.")

        // 새로운 accessToken, refreshToken 발급
        val newTokenInfo: TokenInfo = jwtTokenProvider.validateRefreshTokenAndCreateToken(refreshToken)

        // 기존 refreshToken Redis에서 제거 : refreshToken은 1회용
        refreshTokenInfoRepositoryRedis.deleteByRefreshToken(refreshToken)

        // 새로운 refreshToken Redis에 추가
        refreshTokenInfoRepositoryRedis.save(newTokenInfo.userId, newTokenInfo.refreshToken)

        return newTokenInfo.accessToken
    }
}