package com.s210.backend.common.presentation

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 배포 파이프라인의 health probe 용도.
 * infra/scripts/health-check-<env>.sh 가 `$BASE/api/health` 를 찌른다.
 * 인증 없이 응답해야 하므로 SecurityConfig 의 permitAll 에 등록되어 있다.
 */
@RestController
@RequestMapping("/api")
class HealthController {
    @GetMapping("/health")
    fun health(): Map<String, String> = mapOf("status" to "UP")
}
