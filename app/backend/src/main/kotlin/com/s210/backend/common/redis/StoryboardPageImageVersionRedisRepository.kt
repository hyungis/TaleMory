package com.s210.backend.common.redis

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import java.time.Duration
import java.time.Instant

/**
 * Step 4 스토리보드 페이지 이미지 버전 관리 (Redis 설계 v4 §1.5).
 *
 * 키 트리오:
 *  - `storybook:storyboard-image:versions:{storyboard_page_id}`     (List, 최대 10, TTL 4d)
 *  - `storybook:storyboard-image:current:{storyboard_page_id}`      (String, 현재 선택된 버전, TTL 4d)
 *  - `storybook:storyboard-image:max-version:{storyboard_page_id}`  (String, INCR 카운터, TTL 4d)
 *
 * TTL 4d 는 Spring `@Scheduled` 만료 batch (3d cutoff) 의 fallback. 정상 흐름에선
 * batch 가 먼저 cleanup 하므로 TTL 은 작동하지 않음. batch 가 죽었을 때만 자동 만료.
 *
 * 다음 버전 번호 계산 (`computeNextVersion`):
 *  1) max-version 이 아직 없으면 1 로 init (= 배치 생성본 v1 예약)
 *  2) INCR → 2, 3, 4, ... 반환
 *  → 배치본을 v1 으로 보존하고 재생성 결과는 v2 부터 시작.
 *
 * Lazy v1 push (사용자가 처음 재생성할 때):
 *  - listener 가 `getCurrent == null` 이면 직전 page.imageUrl 을 v1 으로 push 후 새 버전 push.
 *  - 재생성을 한 번도 안 한 페이지는 Redis 에 entry 가 없어 메모리 절약.
 *
 * 삭제:
 *  - PUBLISHED 시 `deleteAll(pageId)` (영구 보존은 storyboard_pages.image_url 의 선택본만)
 *  - DRAFT 만료 batch 시 `deleteAll(pageId)` (스토리 soft-delete 전후)
 *  - 만일 둘 다 누락되어도 4d TTL 안전망으로 자동 만료.
 *
 * Pattern: 기존 `IllustrationVersionRedisRepository` (scene 단위) 와 동일.
 * scene 일러스트와 storyboard 페이지는 별개 단계라 키 prefix 만 분리.
 */
@Repository
class StoryboardPageImageVersionRedisRepository(
    private val redis: StringRedisTemplate,
    private val objectMapper: ObjectMapper,
) {
    companion object {
        const val VERSIONS_PREFIX = "storybook:storyboard-image:versions"
        const val CURRENT_PREFIX = "storybook:storyboard-image:current"
        const val MAX_VERSION_PREFIX = "storybook:storyboard-image:max-version"
        const val MAX_VERSIONS = 10L
        val TTL: Duration = Duration.ofDays(4)
    }

    /**
     * 새 버전 push.
     *
     * 호출 시점:
     *  - listener 가 재생성 SUCCESS 처리 시 (lazy v1 + 새 버전 둘 다)
     *
     * 동작:
     *  - versions 리스트에 LPUSH (최신이 앞)
     *  - LTRIM 으로 최대 10개 유지
     *  - current 를 새 버전 번호로 갱신
     *  - 모든 키 TTL 갱신 (4d fallback)
     */
    fun pushVersion(
        pageId: Long,
        version: Int,
        url: String,
        prompt: String?,
        jobId: Long?,
    ) {
        val versionsKey = versionsKey(pageId)
        val currentKey = currentKey(pageId)

        val entry = mapOf(
            "version" to version,
            "url" to url,
            "prompt" to prompt,
            "createdAt" to Instant.now().toString(),
            "jobId" to jobId,
        )
        val json = objectMapper.writeValueAsString(entry)

        redis.opsForList().leftPush(versionsKey, json)
        redis.opsForList().trim(versionsKey, 0, MAX_VERSIONS - 1)
        redis.expire(versionsKey, TTL)

        redis.opsForValue().set(currentKey, version.toString(), TTL)
    }

    /**
     * 다음 사용할 버전 번호 계산. **Service.regenerateOne 에서 호출**.
     *
     * 1) max-version 키가 없으면 1 로 init (배치 v1 예약)
     * 2) INCR → 2, 3, 4, ... 반환
     *
     * 결과적으로 첫 재생성 = v2, 두 번째 = v3 ...
     * 배치본은 항상 v1 (lazy push 시점에 listener 가 v1 으로 동봉).
     */
    fun computeNextVersion(pageId: Long): Int {
        val key = maxVersionKey(pageId)
        // first-time init: 배치본을 v1 으로 reserve (idempotent)
        redis.opsForValue().setIfAbsent(key, "1", TTL)
        val next = redis.opsForValue().increment(key)
            ?: throw IllegalStateException("Redis INCR returned null for key=$key")
        // INCR 은 TTL 을 갱신하지 않으므로 다시 부여
        redis.expire(key, TTL)
        return next.toInt()
    }

    fun getCurrent(pageId: Long): Int? =
        redis.opsForValue().get(currentKey(pageId))?.toIntOrNull()

    fun listVersions(pageId: Long): List<String> =
        redis.opsForList().range(versionsKey(pageId), 0, -1) ?: emptyList()

    fun setCurrent(pageId: Long, version: Int) {
        redis.opsForValue().set(currentKey(pageId), version.toString(), TTL)
    }

    fun deleteAll(pageId: Long) {
        redis.delete(versionsKey(pageId))
        redis.delete(currentKey(pageId))
        redis.delete(maxVersionKey(pageId))
    }

    internal fun versionsKey(pageId: Long) = "$VERSIONS_PREFIX:$pageId"
    private fun currentKey(pageId: Long) = "$CURRENT_PREFIX:$pageId"
    private fun maxVersionKey(pageId: Long) = "$MAX_VERSION_PREFIX:$pageId"
}
