package com.s210.backend.domain.user.application

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class WithdrawnUserCleanupJob(
    private val withdrawnUserCleanupService: WithdrawnUserCleanupService,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(cron = "0 30 2 * * *", zone = "Asia/Seoul")
    fun removeExpiredWithdrawnUsers() {
        val cutoff = LocalDateTime.now().minusMonths(WITHDRAWN_USER_RETENTION_MONTHS)
        log.info(
            "Withdrawn user cleanup START - cutoff={} ({} months retention)",
            cutoff,
            WITHDRAWN_USER_RETENTION_MONTHS,
        )

        try {
            val count = withdrawnUserCleanupService.removeExpiredWithdrawnUsers(cutoff)
            log.info("Withdrawn user cleanup DONE - removed={}", count)
        } catch (e: Exception) {
            log.warn("Withdrawn user cleanup failed: {}", e.message, e)
        }
    }

    companion object {
        const val WITHDRAWN_USER_RETENTION_MONTHS = 3L
    }
}
