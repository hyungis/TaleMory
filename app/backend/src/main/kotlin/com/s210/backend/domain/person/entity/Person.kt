package com.s210.backend.domain.person.entity

import com.s210.backend.common.entity.SoftDeletableEntity
import com.s210.backend.domain.person.model.Gender
import com.s210.backend.domain.person.model.PersonRole
import jakarta.persistence.*

@Entity
@Table(name = "persons")
class Person(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(nullable = false, length = 100)
    var name: String,

    /**
     * 만 나이. FE 의 AgeInput 입력값을 그대로 저장 (V10 마이그레이션에서 birth_date 를 대체).
     * 서비스 도메인 특성상 출생일 정확도가 불필요해 사용자가 본 값과 DB 값이 동일하도록 단순화.
     */
    @Column(nullable = false)
    var age: Int,

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    var gender: Gender,

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    var role: PersonRole = PersonRole.CHILD
) : SoftDeletableEntity()
