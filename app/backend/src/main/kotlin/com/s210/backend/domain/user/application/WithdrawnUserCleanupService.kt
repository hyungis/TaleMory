package com.s210.backend.domain.user.application

import com.s210.backend.domain.user.infrastructure.repository.WithdrawnUserCleanupRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
class WithdrawnUserCleanupService(
    private val withdrawnUserCleanupRepository: WithdrawnUserCleanupRepository,
) {
    @Transactional
    fun removeExpiredWithdrawnUsers(cutoff: LocalDateTime): Int =
        withdrawnUserCleanupRepository.deleteWithdrawnUsersBefore(cutoff)
}
