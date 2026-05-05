package com.s210.backend.domain.auth.infrastructure.repository

import com.s210.backend.domain.user.entity.User
import org.springframework.data.jpa.repository.JpaRepository

interface MemberRepository : JpaRepository<User, Long> {
    fun findByLoginId(loginId: String): User?
    fun findFirstByLoginIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(loginId: String): User?
    fun findByLoginIdAndDeletedAtIsNull(loginId: String): User?
    fun findByEmail(email: String): User?
    fun findFirstByEmailAndDeletedAtIsNotNullOrderByDeletedAtDesc(email: String): User?
    fun findByEmailAndDeletedAtIsNull(email: String): User?
    fun findByNickname(nickname: String): User?
    fun findByLoginIdAndEmail(loginId: String, email: String): User?
    fun existsByLoginId(loginId: String): Boolean
    fun existsByLoginIdAndDeletedAtIsNull(loginId: String): Boolean
    fun existsByEmail(email: String): Boolean
    fun existsByEmailAndDeletedAtIsNull(email: String): Boolean
    fun existsByNickname(nickname: String): Boolean
    fun existsByNicknameAndDeletedAtIsNull(nickname: String): Boolean
    fun existsByNicknameAndDeletedAtIsNullAndIdNot(nickname: String, id: Long): Boolean
    fun deleteByEmail(email: String)
}
