package com.s210.backend.domain.auth.infrastructure.oauth

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.auth.application.dto.OauthUserProfile
import com.s210.backend.domain.auth.exception.AuthErrorCode
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.SignatureAlgorithm
import io.jsonwebtoken.io.Decoders
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.Date

@Component
class OauthSignupTokenProvider(
    @Value("\${spring.jwt.access_secret}")
    private val accessSecretKey: String,
) {
    private val signingKey by lazy { Keys.hmacShaKeyFor(Decoders.BASE64.decode(accessSecretKey)) }

    fun createToken(profile: OauthUserProfile): String {
        val now = Date()
        val expiration = Date(now.time + SIGNUP_TOKEN_EXPIRATION_MILLISECONDS)

        return Jwts.builder()
            .setSubject(profile.providerUserId)
            .claim(CLAIM_TOKEN_TYPE, TOKEN_TYPE)
            .claim(CLAIM_PROVIDER, profile.provider)
            .claim(CLAIM_EMAIL, profile.email)
            .claim(CLAIM_NAME, profile.name)
            .claim(CLAIM_NICKNAME, profile.nickname)
            .claim(CLAIM_PHONE, profile.phone)
            .setIssuedAt(now)
            .setExpiration(expiration)
            .signWith(signingKey, SignatureAlgorithm.HS256)
            .compact()
    }

    fun parseToken(token: String): OauthSignupToken {
        val claims = try {
            Jwts.parserBuilder()
                .setSigningKey(signingKey)
                .build()
                .parseClaimsJws(token)
                .body
        } catch (e: JwtException) {
            throw BusinessException(AuthErrorCode.OAUTH_SIGNUP_TOKEN_INVALID)
        } catch (e: IllegalArgumentException) {
            throw BusinessException(AuthErrorCode.OAUTH_SIGNUP_TOKEN_INVALID)
        }

        if (claims[CLAIM_TOKEN_TYPE] != TOKEN_TYPE) {
            throw BusinessException(AuthErrorCode.OAUTH_SIGNUP_TOKEN_INVALID)
        }

        return OauthSignupToken(
            provider = claims.getRequiredString(CLAIM_PROVIDER),
            providerUserId = claims.subject ?: throw BusinessException(AuthErrorCode.OAUTH_SIGNUP_TOKEN_INVALID),
            email = claims.getRequiredString(CLAIM_EMAIL),
            name = claims.getRequiredString(CLAIM_NAME),
            nickname = claims.getRequiredString(CLAIM_NICKNAME),
            phone = claims[CLAIM_PHONE] as? String,
        )
    }

    private fun io.jsonwebtoken.Claims.getRequiredString(key: String): String =
        this[key] as? String ?: throw BusinessException(AuthErrorCode.OAUTH_SIGNUP_TOKEN_INVALID)

    companion object {
        private const val SIGNUP_TOKEN_EXPIRATION_MILLISECONDS = 1000L * 60 * 10
        private const val TOKEN_TYPE = "oauth-signup"
        private const val CLAIM_TOKEN_TYPE = "typ"
        private const val CLAIM_PROVIDER = "provider"
        private const val CLAIM_EMAIL = "email"
        private const val CLAIM_NAME = "name"
        private const val CLAIM_NICKNAME = "nickname"
        private const val CLAIM_PHONE = "phone"
    }
}

data class OauthSignupToken(
    val provider: String,
    val providerUserId: String,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String?,
)
