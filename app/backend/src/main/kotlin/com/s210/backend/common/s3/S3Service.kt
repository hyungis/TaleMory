package com.s210.backend.common.s3

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.core.sync.RequestBody
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
    @Value("\${aws.s3.env-prefix}") private val envPrefix: String,
) {
    /**
     * 환경별(local/dev/prod) 격리용 prefix 를 모든 S3 key 앞에 prepend.
     * 같은 버킷 안에서 환경 분리를 위해 사용 — env 가 비어있으면 raw key 그대로 반환.
     *
     * 예: envPrefix="dev" + relativeKey="stories/42/photos/abc.jpg"
     *     → "dev/stories/42/photos/abc.jpg"
     *
     * 신규 key 를 만드는 모든 빌더 (presign*, upload*) 가 이 헬퍼를 거치도록 일원화.
     * 외부에서 받은 s3Key 인자(presignGetUrl/deleteObject/uploadFile)는 이미 완성된 키이므로 가공하지 않는다.
     *
     * 공개 메서드로 노출 — PhotoService / VoiceService / HighlightOutroService 등의
     * commit-단계 prefix 검증(`s3Key.startsWith(expectedPrefix)`)이 환경 prefix 를 인지하도록.
     */
    fun applyEnvPrefix(relativeKey: String): String {
        val cleaned = envPrefix.trim().trim('/')
        return if (cleaned.isEmpty()) relativeKey else "$cleaned/$relativeKey"
    }

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
     * key 규칙: `{envPrefix}/stories/{storyId}/photos/{uuid}.{ext}`.
     * URL 유효 시간 5분.
     */
    fun presignPhotoPutUrl(storyId: Long, contentType: String): PresignedUpload {
        val extension = extensionOf(contentType)
        val key = applyEnvPrefix("stories/$storyId/photos/${UUID.randomUUID()}.$extension")
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

    /**
     * 서버사이드 직접 업로드. multipart 로 받은 파일을 S3 에 저장한다.
     * 반환값은 s3Key.
     */
    fun uploadFile(s3Key: String, bytes: ByteArray, contentType: String): String {
        val putRequest = PutObjectRequest.builder()
            .bucket(bucket)
            .key(s3Key)
            .contentType(contentType)
            .build()
        s3Client.putObject(putRequest, RequestBody.fromBytes(bytes))
        return s3Key
    }

    /**
     * 음성 녹음 업로드용 presigned PUT URL 발급.
     * key 규칙: `{envPrefix}/stories/voice/{userId}/{uuid}.{ext}`.
     */
    fun presignVoicePutUrl(userId: Long, contentType: String): PresignedUpload {
        val extension = audioExtensionOf(contentType)
        val key = applyEnvPrefix("stories/voice/$userId/${UUID.randomUUID()}.$extension")
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

    /**
     * 강조 녹음 업로드용 presigned PUT URL 발급.
     * key 규칙: `{envPrefix}/stories/{storyId}/highlight-voices/{sentenceId}/{uuid}.{ext}`.
     */
    fun presignHighlightVoicePutUrl(storyId: Long, sentenceId: Long, contentType: String): PresignedUpload {
        val extension = audioExtensionOf(contentType)
        val key = applyEnvPrefix("stories/$storyId/highlight-voices/$sentenceId/${UUID.randomUUID()}.$extension")
        return presignAudioPutUrl(key, contentType)
    }

    /**
     * 아웃트로 녹음 업로드용 presigned PUT URL 발급.
     * key 규칙: `{envPrefix}/stories/{storyId}/outro-voice/{uuid}.{ext}`.
     */
    fun presignOutroVoicePutUrl(storyId: Long, contentType: String): PresignedUpload {
        val extension = audioExtensionOf(contentType)
        val key = applyEnvPrefix("stories/$storyId/outro-voice/${UUID.randomUUID()}.$extension")
        return presignAudioPutUrl(key, contentType)
    }

    private fun presignAudioPutUrl(key: String, contentType: String): PresignedUpload {
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

    private fun extensionOf(contentType: String): String = when (contentType.lowercase()) {
        "image/jpeg", "image/jpg" -> "jpg"
        "image/png" -> "png"
        "image/webp" -> "webp"
        "image/gif" -> "gif"
        else -> "bin"
    }

    private fun audioExtensionOf(contentType: String): String = when (contentType.lowercase()) {
        "audio/webm" -> "webm"
        "audio/wav" -> "wav"
        "audio/mpeg" -> "mp3"
        "audio/mp4" -> "m4a"
        "audio/ogg" -> "ogg"
        else -> "bin"
    }
}
