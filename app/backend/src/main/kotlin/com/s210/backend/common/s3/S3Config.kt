package com.s210.backend.common.s3

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.presigner.S3Presigner

/**
 * AWS S3 관련 공용 Bean 정의.
 *
 * - `S3Client`   : 동기 호출용 (headBucket, putObject 등).
 * - `S3Presigner`: presigned URL 발급용 (브라우저가 직접 S3 에 PUT 할 때 사용).
 *
 * 자격증명은 `DefaultCredentialsProvider` 가 환경변수(`AWS_ACCESS_KEY_ID`,
 * `AWS_SECRET_ACCESS_KEY`) 를 자동 인식한다. 로컬에선 IntelliJ Run Configuration
 * 또는 OS env, CI/운영에선 GitLab Variables → 컨테이너 env 경로로 주입.
 */
@Configuration
class S3Config(
    @Value("\${aws.s3.region}") private val region: String,
) {
    @Bean
    fun s3Client(): S3Client = S3Client.builder()
        .region(Region.of(region))
        .credentialsProvider(DefaultCredentialsProvider.create())
        .build()

    @Bean
    fun s3Presigner(): S3Presigner = S3Presigner.builder()
        .region(Region.of(region))
        .credentialsProvider(DefaultCredentialsProvider.create())
        .build()
}
