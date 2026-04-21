package com.s210.backend.domain.auth.infrastructure

import com.s210.backend.domain.auth.application.dto.CustomUser
import com.s210.backend.domain.auth.application.dto.TokenInfo
import io.jsonwebtoken.Claims
import io.jsonwebtoken.ExpiredJwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.MalformedJwtException
import io.jsonwebtoken.SignatureAlgorithm
import io.jsonwebtoken.UnsupportedJwtException
import io.jsonwebtoken.io.Decoders
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.stereotype.Component
import java.util.Date

const val ACCESS_EXPIRATION_MILLISECONDS: Long = 1000L * 60 * 30 // 1시간
const val REFRESH_EXPIRATION_MILLISECONDS: Long = 1000L * 60 * 60 * 24 * 30 // 30일

@Component
class JwtTokenProvider {
    @Value("\${spring.jwt.access_secret}")
    lateinit var accessSecretKey: String

    @Value("\${spring.jwt.refresh_secret}")
    lateinit var refreshSecretKey: String

    private val accessKey by lazy { Keys.hmacShaKeyFor(Decoders.BASE64.decode(accessSecretKey)) }
    private val refreshKey by lazy { Keys.hmacShaKeyFor(Decoders.BASE64.decode(refreshSecretKey)) }

    /**
     * Token 생성
     */
    fun createToken(authentication: Authentication): TokenInfo {
        val authorities = authentication.authorities
            .mapNotNull { it.authority }
            .joinToString(",")

        val now = Date()
        val accessExpiration = Date(now.time + ACCESS_EXPIRATION_MILLISECONDS)
        val refreshExpiration = Date(now.time + REFRESH_EXPIRATION_MILLISECONDS)

        // Access Token
        val accessToken = Jwts
            .builder()
            .setSubject(authentication.name) // 토큰 제목
            .claim("auth", authorities) // 권한
            .setIssuedAt(now) // 토큰 발급시간
            .setExpiration(accessExpiration) // 토큰 만료시간
            .signWith(accessKey, SignatureAlgorithm.HS256) // 키, 알고리즘
            .compact()

        // Refresh Token
        val refreshToken = Jwts
            .builder()
            .setSubject(authentication.name)
            .claim("auth", authorities)
            .setIssuedAt(now)
            .setExpiration(refreshExpiration)
            .signWith(refreshKey, SignatureAlgorithm.HS256)
            .compact()

        return TokenInfo(authentication.name, "Bearer", accessToken, refreshToken)
    }

    /**
     * Token 정보 추출
     */
    fun getAuthentication(token: String): Authentication {
        val claims: Claims = getAccessTokenClaims(token)
        val auth = claims["auth"] ?: throw RuntimeException("잘못된 토큰입니다.")

        // 권한 정보 추출
        val authorities: Collection<GrantedAuthority> = (auth as String)
            .split(",")
            .map { SimpleGrantedAuthority(it) }

        val principal = CustomUser(claims.subject, "", authorities)
        return UsernamePasswordAuthenticationToken(principal, "", authorities)
    }

    fun validateRefreshTokenAndCreateToken(refreshToken: String): TokenInfo {
        try {
            val refreshClaims: Claims = getRefreshTokenClaims(refreshToken)
            val now = Date()

            // 새로운 access 토큰 발급
            val newAccessToken: String = Jwts
                .builder()
                .setSubject(refreshClaims.subject)
                .claim("auth", refreshClaims["auth"])
                .setIssuedAt(now)
                .setExpiration(Date(now.time + ACCESS_EXPIRATION_MILLISECONDS))
                .signWith(accessKey, SignatureAlgorithm.HS256)
                .compact()

            // 새로운 refresh 토큰 발급
            val newRefreshToken: String = Jwts
                .builder()
                .setSubject(refreshClaims.subject)
                .claim("auth", refreshClaims["auth"])
                .setIssuedAt(now)
                .setExpiration(Date(now.time + REFRESH_EXPIRATION_MILLISECONDS))
                .signWith(refreshKey, SignatureAlgorithm.HS256)
                .compact()

            return TokenInfo(refreshClaims.subject, "Bearer", newAccessToken, newRefreshToken)
        } catch (e: Exception) {
            throw e
        }
    }

    fun validateAccessTokenForFilter(token: String): Boolean {
        try {
            getAccessTokenClaims(token)
            return true
        } catch (e: Exception) {
            when (e) {
                is SecurityException -> {}  // Invalid JWT Token
                is MalformedJwtException -> {}  // Invalid JWT Token
                is ExpiredJwtException -> {}    // Expired JWT Token
                is UnsupportedJwtException -> {}    // Unsupported JWT Token
                is IllegalArgumentException -> {}   // JWT claims string is empty
                else -> {}  // else
            }
            throw e
        }
    }

    private fun getAccessTokenClaims(token: String): Claims =
        Jwts.parserBuilder()
            .setSigningKey(accessKey)
            .build()
            .parseClaimsJws(token)
            .body

    private fun getRefreshTokenClaims(token: String): Claims =
        Jwts.parserBuilder()
            .setSigningKey(refreshKey)
            .build()
            .parseClaimsJws(token)
            .body
}