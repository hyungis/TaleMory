package com.s210.backend.domain.user.infrastructure.repository

import com.s210.backend.domain.user.entity.OauthAccount
import org.springframework.data.jpa.repository.JpaRepository

interface OauthAccountRepository : JpaRepository<OauthAccount, Long> {
    fun findByProviderAndProviderUserIdAndDeletedAtIsNull(provider: String, providerUserId: String): OauthAccount?
}
