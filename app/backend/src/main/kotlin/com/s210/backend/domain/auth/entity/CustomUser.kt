package com.s210.backend.domain.auth.entity

import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.userdetails.User

/**
 * Spring Security in-memory 인증 principal.
 * JPA 엔티티가 아니라 요청 수명 동안만 SecurityContext 에 살아 있음.
 *
 * @param userId 로그인한 사용자의 DB PK. JWT 발급/재구성 시 `uid` 클레임으로 실려 다니며,
 *               다른 도메인 컨트롤러가 `@AuthenticationPrincipal user.userId` 로 즉시 참조한다.
 * @param loginId Spring Security 의 username 슬롯. `user.username` 으로도 읽을 수 있다.
 */
class CustomUser(
    val userId: Long,
    loginId: String,
    password: String,
    authorities: Collection<GrantedAuthority>
) : User(loginId, password, authorities)
