package com.s210.backend.common.entity

import jakarta.persistence.Column
import jakarta.persistence.MappedSuperclass
import java.time.LocalDateTime

@MappedSuperclass
abstract class SoftDeletableEntity(
    @Column(name = "deleted_at")
    var deletedAt: LocalDateTime? = null
) : BaseTimeEntity()
