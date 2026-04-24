package com.s210.backend.domain.person.infrastructure.repository

import com.s210.backend.domain.person.entity.Person
import com.s210.backend.domain.person.model.PersonRole
import org.springframework.data.jpa.repository.JpaRepository

interface PersonRepository : JpaRepository<Person, Long> {
    /** 로그인 유저 소유 인물 전체 (soft delete 제외). */
    fun findAllByUserIdAndDeletedAtIsNull(userId: Long): List<Person>

    /** 로그인 유저 소유 + 역할 필터 (child/companion). */
    fun findAllByUserIdAndRoleAndDeletedAtIsNull(userId: Long, role: PersonRole): List<Person>

    /** 소프트 삭제 안 된 특정 인물. 소유권 검증은 Service 에서 userId 비교로 수행. */
    fun findByIdAndDeletedAtIsNull(id: Long): Person?
}
