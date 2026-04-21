package com.s210.backend.domain.auth.application

import com.s210.backend.domain.auth.application.dto.CustomUser
import com.s210.backend.domain.auth.infrastructure.repository.MemberRepository
import com.s210.backend.domain.user.entity.User
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.stereotype.Service

@Service
class CustomUserDetailsService(
    private val memberRepository: MemberRepository
) : UserDetailsService {
    override fun loadUserByUsername(username: String): UserDetails =
        memberRepository.findByLoginId(username)
            ?.let { createUserDetails(it) }
            ?: throw UsernameNotFoundException("해당 유저는 없습니다.")

    private fun createUserDetails(user: User): UserDetails =
        CustomUser(
            user.loginId ?: "",
            user.passwordHash ?: "",
            listOf(SimpleGrantedAuthority("ROLE_MEMBER"))
        )
}