package com.s210.backend.domain.user.infrastructure.repository

import com.s210.backend.domain.user.entity.OauthAccount
import org.springframework.data.jpa.repository.JpaRepository

interface OauthAccountRepository : JpaRepository<OauthAccount, Long> {
    fun findByProviderAndProviderUserId(provider: String, providerUserId: String): OauthAccount?

    fun findByProviderAndProviderUserIdAndDeletedAtIsNull(provider: String, providerUserId: String): OauthAccount?

    fun findFirstByUser_IdAndDeletedAtIsNullOrderByCreatedAtAsc(userId: Long): OauthAccount?

    fun findAllByUser_Id(userId: Long): List<OauthAccount>

    fun findAllByUser_IdAndDeletedAtIsNull(userId: Long): List<OauthAccount>
}
