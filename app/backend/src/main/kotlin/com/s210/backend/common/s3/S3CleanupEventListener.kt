package com.s210.backend.common.s3

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

/**
 * `S3DeletionEvent` 를 소비해 실제 S3 객체를 hard delete 하는 리스너.
 *
 * `AFTER_COMMIT` 단계에서만 실행되어 DB 트랜잭션이 정상 커밋된 경우에만 S3 삭제가 진행된다.
 * S3 호출 실패는 사용자 응답을 막지 않도록 WARN 로깅만 하고 swallow — orphan 은 후속
 * 배치 정리 영역.
 *
 * NOTE: 현재는 동기 호출 (같은 스레드에서 응답 전에 S3 호출 완료).
 * 응답 지연이 체감될 정도로 커지면 `@Async` + `@EnableAsync` 도입해 fire-and-forget 으로 전환.
 */
@Component
class S3CleanupEventListener(
    private val s3Service: S3Service,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun handle(event: S3DeletionEvent) {
        runCatching { s3Service.deleteObject(event.s3Key) }
            .onFailure { log.warn("S3 cleanup failed for key={}", event.s3Key, it) }
    }
}
