package com.s210.backend

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

/**
 * `@EnableScheduling` 활성화 — `@Scheduled` 기반 배치 잡 (e.g. `StoryExpirationJob`) 가 동작하도록.
 * 단일 prod 인스턴스 운영이라 ShedLock 없이도 cron 중복 실행 위험 없음.
 * 인스턴스 수 늘릴 시 `net.javacrumbs.shedlock` 도입 필요.
 */
@SpringBootApplication
@EnableScheduling
class BackendApplication

fun main(args: Array<String>) {
    runApplication<BackendApplication>(*args)
}