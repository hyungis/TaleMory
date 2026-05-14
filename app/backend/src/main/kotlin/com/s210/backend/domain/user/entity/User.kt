package com.s210.backend.domain.user.entity

import com.s210.backend.common.entity.SoftDeletableEntity
import jakarta.persistence.*

@Entity
@Table(name = "users")
class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "login_id", length = 50)
    var loginId: String? = null,

    @Column(name = "password_hash", length = 255)
    var passwordHash: String? = null,

    @Column(nullable = false, length = 255)
    var email: String,

    @Column(nullable = false, length = 100)
    var name: String,

    @Column(nullable = false, length = 100)
    var nickname: String,

    @Column(length = 20)
    var phone: String? = null,

    @Column(name = "agree_sms", nullable = false)
    var agreeSms: Boolean = false,

    @Column(name = "agree_marketing", nullable = false)
    var agreeMarketing: Boolean = false,

    @Column(name = "onboarding_completed", nullable = false)
    var onboardingCompleted: Boolean = false
) : SoftDeletableEntity()
