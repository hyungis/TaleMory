package com.s210.backend.common.s3

/**
 * S3 객체 삭제를 요청하는 도메인 이벤트.
 *
 * 트랜잭션 내부에서 `s3Service.deleteObject` 를 직접 호출하면
 * "S3 삭제 성공 → DB 커밋 실패" 시 **broken image** 가 발생한다 (DB 에는 사진 row
 * 살아있지만 실제 파일은 S3 에 없음 → FE 가 presigned GET URL 요청 시 NoSuchKey).
 *
 * 그래서 삭제 의도만 이벤트로 publish 하고, `S3CleanupEventListener` 가 **DB 커밋이
 * 완전히 끝난 뒤** 실제 S3 DeleteObject 를 호출한다.
 *  - DB 롤백 → 이벤트 발행됐어도 리스너 미실행 → 둘 다 온전
 *  - DB 커밋 후 S3 삭제 실패 → DB 는 soft-delete 상태로 일관 → orphan 만 남음
 *    (orphan 은 후속 배치 job 으로 복구 가능, broken image 보다 훨씬 덜 치명적)
 */
data class S3DeletionEvent(
    val s3Key: String,
)
