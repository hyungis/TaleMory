package com.s210.backend.domain.auth.entity

import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.userdetails.User

class CustomUser(
    loginId: String,
    password: String,
    authorities: Collection<GrantedAuthority>
) : User(loginId, password, authorities)