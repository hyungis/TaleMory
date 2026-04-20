package com.s210.backend.domain.person.infrastructure.repository

import com.s210.backend.domain.person.entity.Person
import org.springframework.data.jpa.repository.JpaRepository

interface PersonRepository : JpaRepository<Person, Long>
