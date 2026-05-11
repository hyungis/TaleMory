package com.s210.backend.domain.auth.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.domain.auth.exception.AuthErrorCode
import com.s210.backend.domain.auth.infrastructure.repository.EmailVerificationRedisRepository
import com.s210.backend.domain.auth.infrastructure.repository.MemberRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.mail.MailException
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.mail.javamail.MimeMessageHelper
import org.springframework.stereotype.Service
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.time.Duration

@Service
class EmailVerificationService(
    private val mailSender: JavaMailSender,
    private val emailVerificationRedisRepository: EmailVerificationRedisRepository,
    private val memberRepository: MemberRepository,
    @Value("\${app.email-verification.sender}") private val sender: String,
    @Value("\${app.email-verification.sender-name:Talemory}") private val senderName: String,
    @Value("\${app.email-verification.code-ttl-seconds:300}") private val codeTtlSeconds: Long,
    @Value("\${app.email-verification.verified-ttl-seconds:1800}") private val verifiedTtlSeconds: Long,
) {
    fun sendVerificationCode(email: String): Long {
        val normalizedEmail = normalizeEmail(email)
        requireValidEmail(normalizedEmail)

        if (memberRepository.existsByEmailAndDeletedAtIsNull(normalizedEmail)) {
            throw BusinessException(CommonErrorCode.DUPLICATE_EMAIL)
        }

        val code = createCode()
        emailVerificationRedisRepository.saveCode(
            email = normalizedEmail,
            code = code,
            ttl = Duration.ofSeconds(codeTtlSeconds),
        )
        emailVerificationRedisRepository.deleteVerified(normalizedEmail)

        try {
            mailSender.send(createMessage(normalizedEmail, code))
        } catch (e: MailException) {
            emailVerificationRedisRepository.deleteCode(normalizedEmail)
            throw BusinessException(AuthErrorCode.EMAIL_SEND_FAILED)
        }

        return codeTtlSeconds
    }

    fun verifyCode(email: String, code: String) {
        val normalizedEmail = normalizeEmail(email)
        requireValidEmail(normalizedEmail)

        val storedCode = emailVerificationRedisRepository.findCode(normalizedEmail)
        if (storedCode == null || storedCode != code.trim()) {
            throw BusinessException(AuthErrorCode.EMAIL_VERIFICATION_INVALID)
        }

        emailVerificationRedisRepository.deleteCode(normalizedEmail)
        emailVerificationRedisRepository.saveVerified(
            email = normalizedEmail,
            ttl = Duration.ofSeconds(verifiedTtlSeconds),
        )
    }

    fun requireVerified(email: String) {
        val normalizedEmail = normalizeEmail(email)
        if (!emailVerificationRedisRepository.existsVerified(normalizedEmail)) {
            throw BusinessException(AuthErrorCode.EMAIL_VERIFICATION_REQUIRED)
        }
    }

    fun consumeVerified(email: String) {
        emailVerificationRedisRepository.deleteVerified(normalizeEmail(email))
    }

    private fun createMessage(email: String, code: String) =
        mailSender.createMimeMessage().apply {
            MimeMessageHelper(this, StandardCharsets.UTF_8.name()).apply {
                val trimmedSenderName = senderName.trim()
                if (trimmedSenderName.isBlank()) {
                    setFrom(this@EmailVerificationService.sender)
                } else {
                    setFrom(this@EmailVerificationService.sender, trimmedSenderName)
                }
                setTo(email)
                setSubject("[Talemory] 이메일 인증번호 안내")
                setText(
                    """
                안녕하세요, Talemory입니다.

                회원가입을 계속하시려면 아래 인증번호를 입력해주세요.

                인증번호: $code
                유효시간: ${codeTtlSeconds / 60}분

                본인이 요청하지 않았다면 이 메일은 무시해주세요.
                    """.trimIndent(),
                )
            }
        }

    private fun createCode(): String =
        (CODE_MIN + secureRandom.nextInt(CODE_RANGE)).toString()

    private fun normalizeEmail(email: String): String =
        email.trim().lowercase()

    private fun requireValidEmail(email: String) {
        if (!EMAIL_PATTERN.matches(email)) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }
    }

    companion object {
        private const val CODE_MIN = 100000
        private const val CODE_RANGE = 900000
        private val secureRandom = SecureRandom()
        private val EMAIL_PATTERN = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
    }
}
