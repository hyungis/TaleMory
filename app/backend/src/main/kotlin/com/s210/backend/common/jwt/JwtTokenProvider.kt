package com.s210.backend.common.jwt

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.entity.TokenInfo
import com.s210.backend.domain.auth.entity.CustomUser
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
import java.security.Key
import java.util.Date

const val ACCESS_EXPIRATION_MILLISECONDS: Long = 1000L * 60 * 30
const val REFRESH_EXPIRATION_MILLISECONDS: Long = 1000L * 60 * 60 * 24 * 30

@Component
class JwtTokenProvider {
    @Value("\${spring.jwt.access_secret}")
    lateinit var accessSecretKey: String

    @Value("\${spring.jwt.refresh_secret}")
    lateinit var refreshSecretKey: String

    private val accessKey by lazy { Keys.hmacShaKeyFor(Decoders.BASE64.decode(accessSecretKey)) }
    private val refreshKey by lazy { Keys.hmacShaKeyFor(Decoders.BASE64.decode(refreshSecretKey)) }

    fun createToken(authentication: Authentication): TokenInfo {
        val subject = authentication.name
        val authorities = authentication.authorities.toAuthorityString()

        val accessToken = createJwt(
            signingKey = accessKey,
            subject = subject,
            authorities = authorities,
            expirationMillis = ACCESS_EXPIRATION_MILLISECONDS,
        )

        val refreshToken = createJwt(
            signingKey = refreshKey,
            subject = subject,
            authorities = authorities,
            expirationMillis = REFRESH_EXPIRATION_MILLISECONDS,
        )

        return TokenInfo(subject, "Bearer", accessToken, refreshToken)
    }

    fun validateRefreshTokenAndCreateToken(refreshToken: String): TokenInfo {
        val refreshClaims = try {
            getRefreshTokenClaims(refreshToken)
        } catch (e: Exception) {
            throw BusinessException(CommonErrorCode.INVALID_REFRESH_TOKEN)
        }

        val subject = refreshClaims.subject
        val authorities = refreshClaims["auth"] as? String
            ?: throw BusinessException(CommonErrorCode.INVALID_REFRESH_TOKEN)

        val newAccessToken = createJwt(
            signingKey = accessKey,
            subject = subject,
            authorities = authorities,
            expirationMillis = ACCESS_EXPIRATION_MILLISECONDS,
        )

        val newRefreshToken = createJwt(
            signingKey = refreshKey,
            subject = subject,
            authorities = authorities,
            expirationMillis = REFRESH_EXPIRATION_MILLISECONDS,
        )

        return TokenInfo(subject, "Bearer", newAccessToken, newRefreshToken)
    }

    fun getAuthentication(token: String): Authentication {
        val claims = getAccessTokenClaims(token)
        val auth = claims["auth"] as? String
            ?: throw BusinessException(CommonErrorCode.INVALID_ACCESS_TOKEN)

        val authorities: Collection<GrantedAuthority> = auth
            .split(",")
            .filter { it.isNotBlank() }
            .map { SimpleGrantedAuthority(it) }

        val principal = CustomUser(claims.subject, "", authorities)
        return UsernamePasswordAuthenticationToken(principal, "", authorities)
    }

    fun validateAccessTokenForFilter(token: String) {
        try {
            getAccessTokenClaims(token)
        } catch (e: Exception) {
            when (e) {
                is SecurityException -> throw BusinessException(CommonErrorCode.INVALID_ACCESS_TOKEN)
                is MalformedJwtException -> throw BusinessException(CommonErrorCode.MALFORMED_ACCESS_TOKEN)
                is ExpiredJwtException -> throw BusinessException(CommonErrorCode.EXPIRED_ACCESS_TOKEN)
                is UnsupportedJwtException -> throw BusinessException(CommonErrorCode.UNSUPPORTED_ACCESS_TOKEN)
                is IllegalArgumentException -> throw BusinessException(CommonErrorCode.EMPTY_ACCESS_TOKEN)
                else -> throw BusinessException(CommonErrorCode.INTERNAL_SERVER_ERROR)
            }
        }
    }

    private fun createJwt(
        signingKey: Key,
        subject: String,
        authorities: String,
        expirationMillis: Long,
    ): String {
        val now = Date()
        val expiration = Date(now.time + expirationMillis)

        return Jwts.builder()
            .setSubject(subject)
            .claim("auth", authorities)
            .setIssuedAt(now)
            .setExpiration(expiration)
            .signWith(signingKey, SignatureAlgorithm.HS256)
            .compact()
    }

    private fun Collection<GrantedAuthority>.toAuthorityString(): String =
        mapNotNull { it.authority }
            .joinToString(",")

    private fun getAccessTokenClaims(token: String): Claims =
        parseClaims(token, accessKey)

    private fun getRefreshTokenClaims(token: String): Claims =
        parseClaims(token, refreshKey)

    private fun parseClaims(token: String, signingKey: Key): Claims =
        Jwts.parserBuilder()
            .setSigningKey(signingKey)
            .build()
            .parseClaimsJws(token)
            .body
}
