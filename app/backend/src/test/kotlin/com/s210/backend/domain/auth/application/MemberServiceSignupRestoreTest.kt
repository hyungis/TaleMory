package com.s210.backend.domain.auth.application

import com.s210.backend.common.entity.TokenInfo
import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.jwt.JwtTokenProvider
import com.s210.backend.common.jwt.RefreshTokenInfoRepositoryRedis
import com.s210.backend.domain.auth.application.dto.OauthCallbackResult
import com.s210.backend.domain.auth.application.dto.OauthSignupCommand
import com.s210.backend.domain.auth.application.dto.OauthUserProfile
import com.s210.backend.domain.auth.application.dto.SignupCommand
import com.s210.backend.domain.auth.application.dto.TermAgreementCommand
import com.s210.backend.domain.auth.exception.AuthErrorCode
import com.s210.backend.domain.auth.infrastructure.oauth.KakaoOAuthClient
import com.s210.backend.domain.auth.infrastructure.oauth.OauthRedirectUriResolver
import com.s210.backend.domain.auth.infrastructure.oauth.OauthSignupToken
import com.s210.backend.domain.auth.infrastructure.oauth.OauthSignupTokenProvider
import com.s210.backend.domain.auth.infrastructure.repository.MemberRepository
import com.s210.backend.domain.user.entity.OauthAccount
import com.s210.backend.domain.user.entity.User
import com.s210.backend.domain.user.exception.UserErrorCode
import com.s210.backend.domain.user.infrastructure.repository.OauthAccountRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.crypto.password.PasswordEncoder
import java.time.LocalDateTime

@ExtendWith(MockitoExtension::class)
class MemberServiceSignupRestoreTest {
    private val memberRepository: MemberRepository = mock(MemberRepository::class.java)
    private val oauthAccountRepository: OauthAccountRepository = mock(OauthAccountRepository::class.java)
    private val jwtTokenProvider: JwtTokenProvider = mock(JwtTokenProvider::class.java)
    private val passwordEncoder: PasswordEncoder = mock(PasswordEncoder::class.java)
    private val refreshTokenInfoRepositoryRedis: RefreshTokenInfoRepositoryRedis =
        mock(RefreshTokenInfoRepositoryRedis::class.java)
    private val authenticationManager: AuthenticationManager = mock(AuthenticationManager::class.java)
    private val kakaoOAuthClient: KakaoOAuthClient = mock(KakaoOAuthClient::class.java)
    private val oauthRedirectUriResolver: OauthRedirectUriResolver = mock(OauthRedirectUriResolver::class.java)
    private val oauthSignupTokenProvider: OauthSignupTokenProvider = mock(OauthSignupTokenProvider::class.java)

    private val service = MemberService(
        memberRepository = memberRepository,
        oauthAccountRepository = oauthAccountRepository,
        jwtTokenProvider = jwtTokenProvider,
        passwordEncoder = passwordEncoder,
        refreshTokenInfoRepositoryRedis = refreshTokenInfoRepositoryRedis,
        authenticationManager = authenticationManager,
        kakaoOAuthClient = kakaoOAuthClient,
        oauthRedirectUriResolver = oauthRedirectUriResolver,
        oauthSignupTokenProvider = oauthSignupTokenProvider,
    )

    @Test
    fun `signUp throws WITHDRAWN_ACCOUNT when loginId belongs to withdrawn user without confirmation`() {
        val user = withdrawnUser()
        `when`(memberRepository.findByLoginIdAndDeletedAtIsNull("old-login")).thenReturn(null)
        `when`(
            memberRepository.findFirstByLoginIdAndDeletedAtIsNotNullOrderByDeletedAtDesc("old-login"),
        ).thenReturn(user)

        val ex = assertThrows<BusinessException> {
            service.signUp(signupCommand(restoreConfirmed = false))
        }

        assertEquals(AuthErrorCode.WITHDRAWN_ACCOUNT, ex.errorCode)
    }

    @Test
    fun `signUp restores withdrawn user and connected oauth accounts after confirmation`() {
        val user = withdrawnUser()
        val oauthAccount = OauthAccount(
            id = 11L,
            user = user,
            provider = "kakao",
            providerUserId = "kakao-user",
            deletedAt = LocalDateTime.now(),
        )
        `when`(memberRepository.findByLoginIdAndDeletedAtIsNull("old-login")).thenReturn(null)
        `when`(
            memberRepository.findFirstByLoginIdAndDeletedAtIsNotNullOrderByDeletedAtDesc("old-login"),
        ).thenReturn(user)
        `when`(oauthAccountRepository.findAllByUser_Id(user.id)).thenReturn(listOf(oauthAccount))
        `when`(passwordEncoder.encode("new-password")).thenReturn("encoded-new-password")

        val userId = service.signUp(signupCommand(restoreConfirmed = true))

        assertEquals(user.id, userId)
        assertEquals("old-login", user.loginId)
        assertEquals("encoded-new-password", user.passwordHash)
        assertEquals("new@example.com", user.email)
        assertEquals("새 이름", user.name)
        assertEquals("새 닉네임", user.nickname)
        assertEquals("010-1234-5678", user.phone)
        assertFalse(user.agreeSms)
        assertFalse(user.agreeMarketing)
        assertNull(user.deletedAt)
        assertNull(oauthAccount.deletedAt)
    }

    @Test
    fun `signUp restores withdrawn user found by email after confirmation`() {
        val user = withdrawnUser()
        `when`(memberRepository.findByLoginIdAndDeletedAtIsNull("old-login")).thenReturn(null)
        `when`(
            memberRepository.findFirstByEmailAndDeletedAtIsNotNullOrderByDeletedAtDesc("new@example.com"),
        ).thenReturn(user)
        `when`(oauthAccountRepository.findAllByUser_Id(user.id)).thenReturn(emptyList())
        `when`(passwordEncoder.encode("new-password")).thenReturn("encoded-new-password")

        val userId = service.signUp(signupCommand(restoreConfirmed = true))

        assertEquals(user.id, userId)
        assertEquals("old-login", user.loginId)
        assertEquals("encoded-new-password", user.passwordHash)
        assertEquals("new@example.com", user.email)
        assertEquals("새 이름", user.name)
        assertEquals("새 닉네임", user.nickname)
        assertNull(user.deletedAt)
    }

    @Test
    fun `signUp throws INVALID_INPUT when password check differs`() {
        val ex = assertThrows<BusinessException> {
            service.signUp(signupCommand(restoreConfirmed = false, passwordCheck = "different-password"))
        }

        assertEquals(CommonErrorCode.INVALID_INPUT, ex.errorCode)
    }

    @Test
    fun `signUp throws INVALID_INPUT when required terms are not agreed`() {
        val ex = assertThrows<BusinessException> {
            service.signUp(
                signupCommand(
                    restoreConfirmed = false,
                    termAgreements = listOf(
                        TermAgreementCommand(termId = 1L, agreed = true),
                        TermAgreementCommand(termId = 2L, agreed = false),
                    ),
                )
            )
        }

        assertEquals(CommonErrorCode.INVALID_INPUT, ex.errorCode)
    }

    @Test
    fun `signUp throws NICKNAME_DUPLICATED when active nickname already exists`() {
        `when`(memberRepository.findByLoginIdAndDeletedAtIsNull("old-login")).thenReturn(null)
        `when`(memberRepository.findByEmailAndDeletedAtIsNull("new@example.com")).thenReturn(null)
        `when`(
            memberRepository.findFirstByLoginIdAndDeletedAtIsNotNullOrderByDeletedAtDesc("old-login"),
        ).thenReturn(null)
        `when`(
            memberRepository.findFirstByEmailAndDeletedAtIsNotNullOrderByDeletedAtDesc("new@example.com"),
        ).thenReturn(null)
        `when`(memberRepository.existsByNicknameAndDeletedAtIsNull("새 닉네임")).thenReturn(true)

        val ex = assertThrows<BusinessException> {
            service.signUp(signupCommand(restoreConfirmed = false))
        }

        assertEquals(UserErrorCode.NICKNAME_DUPLICATED, ex.errorCode)
    }

    @Test
    fun `findLoginIdAvailability returns unavailable for active login id`() {
        `when`(memberRepository.existsByLoginIdAndDeletedAtIsNull("used-login")).thenReturn(true)

        val result = service.findLoginIdAvailability(" used-login ")

        assertEquals(false, result.available)
    }

    @Test
    fun `findNicknameAvailability returns available for unused nickname`() {
        `when`(memberRepository.existsByNicknameAndDeletedAtIsNull("새 닉네임")).thenReturn(false)

        val result = service.findNicknameAvailability(" 새 닉네임 ")

        assertTrue(result.available)
    }

    @Test
    fun `kakao callback returns restore required for withdrawn oauth account without restoring immediately`() {
        val user = withdrawnUser()
        val oauthAccount = OauthAccount(
            id = 11L,
            user = user,
            provider = "kakao",
            providerUserId = "kakao-user",
            deletedAt = LocalDateTime.now(),
        )
        val profile = oauthProfile()
        `when`(
            oauthRedirectUriResolver.requireAllowedRedirectUri("http://localhost/callback"),
        ).thenReturn("http://localhost/callback")
        `when`(kakaoOAuthClient.fetchUserProfile("code", "http://localhost/callback")).thenReturn(profile)
        `when`(
            oauthAccountRepository.findByProviderAndProviderUserId("kakao", "kakao-user"),
        ).thenReturn(oauthAccount)
        `when`(oauthSignupTokenProvider.createToken(profile)).thenReturn("restore-token")

        val result = service.loginWithKakaoCallback("code", "http://localhost/callback")

        assertTrue(result is OauthCallbackResult.RestoreRequired)
        val restoreRequired = result as OauthCallbackResult.RestoreRequired
        assertEquals("restore-token", restoreRequired.signupToken)
        assertEquals("old@example.com", restoreRequired.profile.email)
        assertTrue(user.deletedAt != null)
        assertTrue(oauthAccount.deletedAt != null)
    }

    @Test
    fun `kakao callback returns link required when active email user exists`() {
        val user = activeUser()
        val profile = oauthProfile()
        `when`(
            oauthRedirectUriResolver.requireAllowedRedirectUri("http://localhost/callback"),
        ).thenReturn("http://localhost/callback")
        `when`(kakaoOAuthClient.fetchUserProfile("code", "http://localhost/callback")).thenReturn(profile)
        `when`(memberRepository.findByEmailAndDeletedAtIsNull("old@example.com")).thenReturn(user)
        `when`(oauthSignupTokenProvider.createToken(profile)).thenReturn("link-token")

        val result = service.loginWithKakaoCallback("code", "http://localhost/callback")

        assertTrue(result is OauthCallbackResult.LinkRequired)
        val linkRequired = result as OauthCallbackResult.LinkRequired
        assertEquals("link-token", linkRequired.signupToken)
        assertEquals("old@example.com", linkRequired.profile.email)
    }

    @Test
    fun `signUpWithKakao links active email user after confirmation`() {
        val user = activeUser()
        `when`(oauthSignupTokenProvider.parseToken("signup-token")).thenReturn(
            OauthSignupToken(
                provider = "kakao",
                providerUserId = "kakao-user",
                email = "old@example.com",
                name = "Kakao Name",
                nickname = "Kakao Nickname",
                phone = null,
            )
        )
        `when`(memberRepository.findByEmailAndDeletedAtIsNull("old@example.com")).thenReturn(user)
        `when`(jwtTokenProvider.createToken(any(org.springframework.security.core.Authentication::class.java)))
            .thenReturn(TokenInfo("old-login", "Bearer", "access-token", "refresh-token"))

        val result = service.signUpWithKakao(
            OauthSignupCommand(
                signupToken = "signup-token",
                email = "old@example.com",
                name = "Kakao Name",
                nickname = "Kakao Nickname",
                phone = null,
                linkConfirmed = true,
            )
        )

        assertEquals(user.id, result.user.id)
        assertEquals("kakao", result.provider)
        val oauthAccountCaptor = ArgumentCaptor.forClass(OauthAccount::class.java)
        verify(oauthAccountRepository).save(oauthAccountCaptor.capture())
        assertEquals(user, oauthAccountCaptor.value.user)
        assertEquals("kakao", oauthAccountCaptor.value.provider)
        assertEquals("kakao-user", oauthAccountCaptor.value.providerUserId)
    }

    @Test
    fun `signUpWithKakao still requires terms when link confirmation has no active email user`() {
        `when`(oauthSignupTokenProvider.parseToken("signup-token")).thenReturn(
            OauthSignupToken(
                provider = "kakao",
                providerUserId = "kakao-user",
                email = "new@example.com",
                name = "Kakao Name",
                nickname = "Kakao Nickname",
                phone = null,
            )
        )

        val ex = assertThrows<BusinessException> {
            service.signUpWithKakao(
                OauthSignupCommand(
                    signupToken = "signup-token",
                    email = "new@example.com",
                    name = "Kakao Name",
                    nickname = "Kakao Nickname",
                    phone = null,
                    linkConfirmed = true,
                )
            )
        }

        assertEquals(CommonErrorCode.INVALID_INPUT, ex.errorCode)
    }

    @Test
    fun `signUpWithKakao rejects request email that differs from kakao signup token email`() {
        `when`(oauthSignupTokenProvider.parseToken("signup-token")).thenReturn(
            OauthSignupToken(
                provider = "kakao",
                providerUserId = "kakao-user",
                email = "kakao@example.com",
                name = "카카오 이름",
                nickname = "카카오 닉네임",
                phone = null,
            )
        )

        val ex = assertThrows<BusinessException> {
            service.signUpWithKakao(
                OauthSignupCommand(
                    signupToken = "signup-token",
                    email = "other@example.com",
                    name = "카카오 이름",
                    nickname = "카카오 닉네임",
                    phone = null,
                    termAgreements = requiredTermAgreements(),
                )
            )
        }

        assertEquals(CommonErrorCode.INVALID_INPUT, ex.errorCode)
    }

    private fun withdrawnUser(): User =
        User(
            id = 1L,
            loginId = "old-login",
            passwordHash = "old-password",
            email = "old@example.com",
            name = "기존 이름",
            nickname = "기존 닉네임",
        ).also {
            it.deletedAt = LocalDateTime.now().minusDays(7)
        }

    private fun activeUser(): User =
        User(
            id = 1L,
            loginId = "old-login",
            passwordHash = "old-password",
            email = "old@example.com",
            name = "Existing User",
            nickname = "Existing Nickname",
        )

    private fun signupCommand(
        restoreConfirmed: Boolean,
        passwordCheck: String? = null,
        termAgreements: List<TermAgreementCommand> = requiredTermAgreements(),
    ): SignupCommand =
        SignupCommand(
            loginId = "old-login",
            password = "new-password",
            passwordCheck = passwordCheck,
            email = "new@example.com",
            name = "새 이름",
            nickname = "새 닉네임",
            phone = "010-1234-5678",
            termAgreements = termAgreements,
            restoreConfirmed = restoreConfirmed,
        )

    private fun requiredTermAgreements(): List<TermAgreementCommand> =
        listOf(
            TermAgreementCommand(termId = 1L, agreed = true),
            TermAgreementCommand(termId = 2L, agreed = true),
        )

    private fun oauthProfile(): OauthUserProfile =
        OauthUserProfile(
            provider = "kakao",
            providerUserId = "kakao-user",
            email = "old@example.com",
            name = "기존 이름",
            nickname = "기존 닉네임",
            phone = null,
        )
}
