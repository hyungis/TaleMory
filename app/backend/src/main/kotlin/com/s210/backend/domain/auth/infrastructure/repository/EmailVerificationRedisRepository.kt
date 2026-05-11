package com.s210.backend.domain.auth.infrastructure.repository

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Repository
import java.time.Duration

@Repository
class EmailVerificationRedisRepository(
    private val redis: StringRedisTemplate,
) {
    fun saveCode(email: String, code: String, ttl: Duration) {
        redis.opsForValue().set(codeKey(email), code, ttl)
    }

    fun findCode(email: String): String? =
        redis.opsForValue().get(codeKey(email))

    fun deleteCode(email: String) {
        redis.delete(codeKey(email))
    }

    fun saveVerified(email: String, ttl: Duration) {
        redis.opsForValue().set(verifiedKey(email), VERIFIED_VALUE, ttl)
    }

    fun existsVerified(email: String): Boolean =
        redis.hasKey(verifiedKey(email))

    fun deleteVerified(email: String) {
        redis.delete(verifiedKey(email))
    }

    private fun codeKey(email: String): String =
        "$CODE_KEY_PREFIX:${email.lowercase()}"

    private fun verifiedKey(email: String): String =
        "$VERIFIED_KEY_PREFIX:${email.lowercase()}"

    companion object {
        private const val CODE_KEY_PREFIX = "auth:email-verification:code"
        private const val VERIFIED_KEY_PREFIX = "auth:email-verification:verified"
        private const val VERIFIED_VALUE = "true"
    }
}
