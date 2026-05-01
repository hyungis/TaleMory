package com.s210.backend.domain.story.application

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.LocalDateTime

/**
 * DRAFT (또는 PUBLISHED 가 아닌) 스토리를 보관 기간 초과 시 자동 정리하는 배치 잡.
 *
 * 정책:
 *  - cutoff = `now - 3d` (createdAt 기준).
 *  - 출판된(PUBLISHED) 스토리는 보존.
 *  - 페이지별 storyboard-image S3 versioned 객체 + Redis 트리오까지 cleanup
 *    (`StoryService.expireDrafts` 안에서 처리).
 *
 * 실행:
 *  - `@Scheduled` cron — 매일 02:00 KST 1회.
 *  - 단일 prod 인스턴스 운영 (CLAUDE.md / 사용자 확인) → ShedLock 미도입.
 *    인스턴스 수 늘릴 시 락 도입 필요 (그렇지 않으면 같은 row 를 N 번 cleanup 시도).
 *
 * 운영:
 *  - INFO 로 잡 시작 / 종료 + 처리 row 수 로깅.
 *  - 예외는 catch 해 WARN — 다음 날 cron 에서 재처리되도록.
 */
@Component
class StoryExpirationJob(
    private val storyService: StoryService,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        /** 보관 일수 — DRAFT 가 createdAt 후 이 일수만큼 지나면 만료 대상. */
        const val DRAFT_RETENTION_DAYS = 3L
    }

    /**
     * 매일 02:00:00 KST 실행. 트래픽 적은 새벽 시간대에 일괄 cleanup.
     *
     * cron 표현 6필드 — `초 분 시 일 월 요일`. Spring `@Scheduled` 기본은 6필드 cron 이며
     * `application*.yml` 의 `spring.task.scheduling.timezone` 가 없을 시 JVM default zone.
     */
    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Seoul")
    fun expireOldDrafts() {
        val cutoff = LocalDateTime.now().minusDays(DRAFT_RETENTION_DAYS)
        log.info("Story expiration batch START — cutoff={} ({}d retention)", cutoff, DRAFT_RETENTION_DAYS)
        try {
            val count = storyService.expireDrafts(cutoff)
            log.info("Story expiration batch DONE — expired={}", count)
        } catch (e: Exception) {
            // 한 row 의 S3/Redis 실패가 다른 row 정리를 막지 않도록 잡 단위에서 swallow.
            // 실제 row 단위 실패는 service 안에서 best-effort 로 흡수되며, 여기서는
            // findExpiredDrafts / saveAll 등 잡 전체 fatal 경로만 잡힌다.
            log.warn("Story expiration batch failed: {}", e.message, e)
        }
    }
}
