package com.s210.backend.domain.user.application

import com.s210.backend.domain.user.infrastructure.repository.WithdrawnUserCleanupRepository
import org.springframework.stereotype.Service
import java.time.LocalDateTime

@Service
class WithdrawnUserCleanupService(
    private val withdrawnUserCleanupRepository: WithdrawnUserCleanupRepository,
) {
    fun removeExpiredWithdrawnUsers(cutoff: LocalDateTime): Int {
        var removedCount = 0

        while (true) {
            val userIds = withdrawnUserCleanupRepository.findExpiredWithdrawnUserIds(
                cutoff = cutoff,
                limit = DELETE_BATCH_SIZE,
            )
            if (userIds.isEmpty()) return removedCount

            removedCount += withdrawnUserCleanupRepository.deleteWithdrawnUsersByIds(userIds, cutoff)
        }
    }

    companion object {
        private const val DELETE_BATCH_SIZE = 100
    }
}
