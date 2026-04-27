package com.s210.backend.domain.user.infrastructure.repository

import com.s210.backend.domain.user.entity.User
import org.springframework.data.jpa.repository.JpaRepository

interface UserRepository : JpaRepository<User, Long> {
    fun findByIdAndDeletedAtIsNull(id: Long): User?

    fun existsByNicknameAndDeletedAtIsNullAndIdNot(nickname: String, id: Long): Boolean
}
