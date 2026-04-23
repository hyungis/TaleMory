package com.s210.backend.common.s3

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import software.amazon.awssdk.services.s3.model.HeadBucketRequest
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * S3 접근 공용 서비스.
 *
 * - `verifyAccess`         : 버킷 접근 가능 여부 확인 (배포 검증용 health 엔드포인트에서 사용).
 * - `presignPutUrl`        : 브라우저가 직접 S3 로 PUT 할 presigned URL 발급.
 * - `buildPublicImageUrl`  : s3Key → 풀 URL 로 변환 (DB 저장용).
 */
@Service
class S3Service(
    private val s3Client: S3Client,
    private val s3Presigner: S3Presigner,
    @Value("\${aws.s3.bucket}") private val bucket: String,
    @Value("\${aws.s3.region}") private val region: String,
) {
    /**
     * 버킷 존재 + 현재 IAM user 의 접근 권한을 한 번에 검증.
     * 권한 없으면 `S3Exception` 이 그대로 던져진다.
     */
    fun verifyAccess() {
        s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build())
    }

    data class PresignedUpload(
        val uploadUrl: String,
        val s3Key: String,
        val expiresAt: Instant,
    )

    /**
     * Step 2 사진 업로드용 presigned PUT URL 발급.
     * key 규칙: `stories/{storyId}/photos/{uuid}.{ext}`.
     * URL 유효 시간 5분.
     */
    fun presignPhotoPutUrl(storyId: Long, contentType: String): PresignedUpload {
        val extension = extensionOf(contentType)
        val key = "stories/$storyId/photos/${UUID.randomUUID()}.$extension"
        val putRequest = PutObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .contentType(contentType)
            .build()

        val signatureDuration = Duration.ofMinutes(5)
        val presigned = s3Presigner.presignPutObject(
            PutObjectPresignRequest.builder()
                .signatureDuration(signatureDuration)
                .putObjectRequest(putRequest)
                .build()
        )
        return PresignedUpload(
            uploadUrl = presigned.url().toString(),
            s3Key = key,
            expiresAt = Instant.now().plus(signatureDuration),
        )
    }

    /** `s3Key` → 버킷의 HTTPS URL 로 변환 (public 버킷 전용, 현재 우리는 private 이라 참고용). */
    fun buildPublicImageUrl(s3Key: String): String =
        "https://$bucket.s3.$region.amazonaws.com/$s3Key"

    /**
     * S3 객체 즉시 hard delete. 사진 삭제 시 DB soft delete 와 함께 호출해
     * 버킷에 orphan 이 쌓이지 않도록 한다.
     * 없는 key 를 지워도 AWS 는 예외 없이 성공 응답 (idempotent).
     */
    fun deleteObject(s3Key: String) {
        s3Client.deleteObject(
            DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(s3Key)
                .build()
        )
    }

    /**
     * private 버킷의 이미지를 FE 가 `<img src>` 로 로드할 수 있도록 발급하는 만료형 GET URL.
     *
     * TTL 기본 1시간 — 사용자가 Step 2 페이지에 오래 머물러도 이미지가 끊기지 않게.
     * React Query staleTime 은 이 값보다 짧게 잡아 만료 전 refetch 하도록 유도.
     * (PUT URL 은 5분 유지 — 업로드는 즉시 수행이므로 짧아야 안전.)
     */
    fun presignGetUrl(s3Key: String, ttl: Duration = Duration.ofHours(1)): String {
        val getRequest = GetObjectRequest.builder()
            .bucket(bucket)
            .key(s3Key)
            .build()
        val presigned = s3Presigner.presignGetObject(
            GetObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .getObjectRequest(getRequest)
                .build()
        )
        return presigned.url().toString()
    }

    private fun extensionOf(contentType: String): String = when (contentType.lowercase()) {
        "image/jpeg", "image/jpg" -> "jpg"
        "image/png" -> "png"
        "image/webp" -> "webp"
        "image/gif" -> "gif"
        else -> "bin"
    }
}
