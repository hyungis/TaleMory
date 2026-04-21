package com.s210.backend.domain.person.entity

import com.s210.backend.common.entity.SoftDeletableEntity
import com.s210.backend.domain.person.model.Gender
import com.s210.backend.domain.person.model.PersonRole
import jakarta.persistence.*
import java.time.LocalDate

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

    @Column(name = "birth_date", nullable = false)
    var birthDate: LocalDate,

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    var gender: Gender,

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    var role: PersonRole = PersonRole.CHILD
) : SoftDeletableEntity()
