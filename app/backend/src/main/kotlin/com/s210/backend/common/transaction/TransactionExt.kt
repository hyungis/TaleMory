package com.s210.backend.common.transaction

import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager

/**
 * 활성 트랜잭션이 **commit 된 후** 에 [action] 을 실행한다.
 * 트랜잭션 밖에서 호출되면 즉시 실행 (방어 fallback — 호출자가 컨텍스트를 잘못 잡았어도 동작 보장).
 *
 * 사용 패턴: 영속성 변경(write) 직후 Redis 캐시 invalidate 같은 외부 시스템 mutation 을
 * commit 이후로 미뤄 **pre-commit race** 를 차단한다.
 *
 * pre-commit race 시나리오:
 *  1) `@Transactional` 안에서 `entity.status = SUCCESS` (영속성 컨텍스트만 dirty, DB 미반영)
 *  2) 같은 메서드에서 `redis.delete(cacheKey)` 즉시 호출
 *  3) 다른 스레드 polling 진입 → cache miss → DB 조회 → **아직 RUNNING** (commit 전)
 *  4) 다른 스레드가 RUNNING 을 캐시에 적재
 *  5) 원 트랜잭션 commit → DB=SUCCESS, Redis=RUNNING (TTL 만료까지 stale 박제)
 *
 * `afterCommit` 으로 (2) 를 (5) 이후로 미루면 (3)~(4) 가 들어와도 DB 가 이미 SUCCESS 라
 * 캐시 적재 자체가 안 일어남 (cache-aside 정책: 종결 잡은 캐시 X).
 */
fun afterCommit(action: () -> Unit) {
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
        TransactionSynchronizationManager.registerSynchronization(
            object : TransactionSynchronization {
                override fun afterCommit() {
                    action()
                }
            },
        )
    } else {
        // 트랜잭션 밖 호출 — 즉시 실행. 보통 도달하지 않지만 방어용 (단위 테스트 / 잘못된 호출).
        action()
    }
}
