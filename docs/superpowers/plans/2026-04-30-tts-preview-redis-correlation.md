# TTS Preview Redis Correlation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TTS preview 의 correlation/state 를 MySQL `story_generation_jobs` 에서 Redis Hash 로 이전. 현재 dev 에서 발생 중인 500 (job_type ENUM truncation) 을 해소하고, preview 의 휘발적 본질을 코드 구조에 반영한다.

**Architecture:**
- 신규 `TtsPreviewRedisRepository` — `storybook:tts:preview:{previewId}` Hash, TTL 1시간. 기존 `JobStatusRedisRepository` 패턴 미러.
- previewId 는 UUID v4 (RabbitMQ 메시지의 `jobId` 필드에 그대로 사용 → AI 워커 변경 없음).
- 신규 `GET /api/voice-profiles/previews/{previewId}` 엔드포인트로 FE polling.
- 기존 `JobType.TTS_PREVIEW` enum 멤버 및 `JobService` preview 분기는 dead code 가 되므로 같은 PR 에서 삭제.

**Tech Stack:** Kotlin / Spring Boot 3.x, Mockito, AssertJ, JUnit 5, Spring Data Redis (`StringRedisTemplate`), React 19, Vite, TypeScript, pnpm.

**Spec:** `docs/superpowers/specs/2026-04-30-tts-preview-redis-correlation-design.md`

---

## File Map

### Backend

**Create:**
- `app/backend/src/main/kotlin/com/s210/backend/common/redis/TtsPreviewRedisRepository.kt`
  - `TtsPreviewRedisRepository` (`@Repository`)
  - `TtsPreviewSnapshot` data class (sibling)
- `app/backend/src/test/kotlin/com/s210/backend/common/redis/TtsPreviewRedisRepositoryTest.kt`
- `app/backend/src/main/kotlin/com/s210/backend/domain/tts/presentation/response/TtsPreviewStatusResponse.kt`
- `app/backend/src/test/kotlin/com/s210/backend/domain/voice/presentation/VoiceControllerPreviewStatusTest.kt`

**Modify:**
- `app/backend/src/main/kotlin/com/s210/backend/domain/tts/application/VoicePreviewService.kt` — Redis 기반으로 재작성, `getStatus` 추가
- `app/backend/src/main/kotlin/com/s210/backend/domain/tts/application/TtsResultHandler.kt` — `handle(PreviewTtsResultEnvelope)` 본문 교체
- `app/backend/src/main/kotlin/com/s210/backend/domain/voice/presentation/VoiceController.kt` — POST 응답 필드명 변경, GET status 핸들러 추가
- `app/backend/src/main/kotlin/com/s210/backend/domain/voice/presentation/response/VoiceResponse.kt` — `VoicePreviewJobResponse.jobId: Long` → `previewId: String`
- `app/backend/src/main/kotlin/com/s210/backend/domain/job/model/JobType.kt` — `TTS_PREVIEW` 멤버 삭제
- `app/backend/src/main/kotlin/com/s210/backend/domain/job/application/JobService.kt` — `assertPreviewOwned()` 및 분기 삭제, `voiceProfileRepository`/`objectMapper` 의존 정리
- `app/backend/src/test/kotlin/com/s210/backend/domain/tts/application/VoicePreviewServiceTest.kt` — Redis mock 으로 재작성
- `app/backend/src/test/kotlin/com/s210/backend/domain/tts/application/TtsResultHandlerTest.kt` — preview 케이스 추가
- `app/backend/src/test/kotlin/com/s210/backend/domain/job/presentation/JobControllerPollingTest.kt` — preview 케이스 삭제, 시그니처 정리

### Frontend

**Create:**
- `app/frontend/src/features/mypage/voice-profile-manager/api/getVoicePreview.ts`

**Modify:**
- `app/frontend/src/features/mypage/voice-profile-manager/api/postVoicePreview.ts` — 응답 타입 `jobId: number` → `previewId: string`
- `app/frontend/src/features/mypage/voice-profile-manager/lib/useVoiceClone.ts` — polling 호출 swap
- `app/frontend/src/features/story-creation/voice-clone/api/voiceProfileApi.ts` — 응답 타입 변경 + `getVoicePreview` 추가
- `app/frontend/src/features/story-creation/voice-clone/model/useVoiceClone.ts` — polling 호출 swap

---

## Task 0: 브랜치 / 워크트리 셋업

**Files:** —

- [ ] **Step 1: dev 최신 fetch**

```bash
git fetch origin dev
```

- [ ] **Step 2: 새 브랜치 생성 (현재 브랜치는 보존)**

```bash
git worktree add ../S14P31S210-tts-preview-redis -b feature/tts/preview-redis-correlation origin/dev
cd ../S14P31S210-tts-preview-redis
```

Expected: 새 워크트리 생성, `feature/tts/preview-redis-correlation` 브랜치 체크아웃, base = `origin/dev`.

- [ ] **Step 3: spec 파일 워크트리에서도 보이는지 확인**

```bash
ls docs/superpowers/specs/2026-04-30-tts-preview-redis-correlation-design.md
```

Expected: 파일 존재 (origin/dev 에는 spec 이 없으니 cherry-pick 필요).

- [ ] **Step 4: spec commit cherry-pick**

```bash
git cherry-pick 8dc4d13
```

Expected: spec 커밋이 새 브랜치에 적용됨. 충돌 없음.

---

## Task 1: TtsPreviewRedisRepository + Snapshot + tests

**Files:**
- Create: `app/backend/src/main/kotlin/com/s210/backend/common/redis/TtsPreviewRedisRepository.kt`
- Create: `app/backend/src/test/kotlin/com/s210/backend/common/redis/TtsPreviewRedisRepositoryTest.kt`

- [ ] **Step 1: 실패 테스트 작성**

`app/backend/src/test/kotlin/com/s210/backend/common/redis/TtsPreviewRedisRepositoryTest.kt`:

```kotlin
package com.s210.backend.common.redis

import com.s210.backend.domain.job.model.JobStatus
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.data.redis.core.HashOperations
import org.springframework.data.redis.core.StringRedisTemplate
import java.time.Duration
import java.time.Instant

@ExtendWith(MockitoExtension::class)
class TtsPreviewRedisRepositoryTest {

    private lateinit var redis: StringRedisTemplate
    private lateinit var hashOps: HashOperations<String, String, String>
    private lateinit var repo: TtsPreviewRedisRepository

    @BeforeEach
    fun setUp() {
        redis = mock(StringRedisTemplate::class.java)
        @Suppress("UNCHECKED_CAST")
        hashOps = mock(HashOperations::class.java) as HashOperations<String, String, String>
        `when`(redis.opsForHash<String, String>()).thenReturn(hashOps)
        repo = TtsPreviewRedisRepository(redis)
    }

    @Test
    fun `createPending writes PENDING fields and applies TTL`() {
        val previewId = "p-1"
        val key = "storybook:tts:preview:$previewId"

        @Suppress("UNCHECKED_CAST")
        val mapCaptor = ArgumentCaptor.forClass(Map::class.java) as ArgumentCaptor<Map<String, String>>
        val ttlCaptor = ArgumentCaptor.forClass(Duration::class.java)

        repo.createPending(previewId = previewId, userId = 7L, voiceProfileId = 42L)

        verify(hashOps).putAll(org.mockito.ArgumentMatchers.eq(key), mapCaptor.capture())
        verify(redis).expire(org.mockito.ArgumentMatchers.eq(key), ttlCaptor.capture())

        val captured = mapCaptor.value
        assertThat(captured["userId"]).isEqualTo("7")
        assertThat(captured["voiceProfileId"]).isEqualTo("42")
        assertThat(captured["status"]).isEqualTo("PENDING")
        assertThat(captured).containsKey("createdAt")
        assertThat(captured).doesNotContainKey("audioUrl")
        assertThat(captured).doesNotContainKey("errorCode")
        assertThat(ttlCaptor.value).isEqualTo(TtsPreviewRedisRepository.TTL)
    }

    @Test
    fun `markSuccess sets status SUCCESS and audioUrl and finishedAt`() {
        val previewId = "p-2"
        val key = "storybook:tts:preview:$previewId"

        @Suppress("UNCHECKED_CAST")
        val mapCaptor = ArgumentCaptor.forClass(Map::class.java) as ArgumentCaptor<Map<String, String>>

        repo.markSuccess(previewId = previewId, audioUrl = "https://s3/preview.wav")

        verify(hashOps).putAll(org.mockito.ArgumentMatchers.eq(key), mapCaptor.capture())
        verify(redis).expire(org.mockito.ArgumentMatchers.eq(key), org.mockito.ArgumentMatchers.eq(TtsPreviewRedisRepository.TTL))

        val captured = mapCaptor.value
        assertThat(captured["status"]).isEqualTo("SUCCESS")
        assertThat(captured["audioUrl"]).isEqualTo("https://s3/preview.wav")
        assertThat(captured).containsKey("finishedAt")
    }

    @Test
    fun `markFailed sets status FAILED with errorCode and errorMessage and finishedAt`() {
        val previewId = "p-3"
        val key = "storybook:tts:preview:$previewId"

        @Suppress("UNCHECKED_CAST")
        val mapCaptor = ArgumentCaptor.forClass(Map::class.java) as ArgumentCaptor<Map<String, String>>

        repo.markFailed(previewId = previewId, errorCode = "TTS_INFER_FAILED", errorMessage = "GPU OOM")

        verify(hashOps).putAll(org.mockito.ArgumentMatchers.eq(key), mapCaptor.capture())
        verify(redis).expire(org.mockito.ArgumentMatchers.eq(key), org.mockito.ArgumentMatchers.eq(TtsPreviewRedisRepository.TTL))

        val captured = mapCaptor.value
        assertThat(captured["status"]).isEqualTo("FAILED")
        assertThat(captured["errorCode"]).isEqualTo("TTS_INFER_FAILED")
        assertThat(captured["errorMessage"]).isEqualTo("GPU OOM")
        assertThat(captured).containsKey("finishedAt")
        assertThat(captured).doesNotContainKey("audioUrl")
    }

    @Test
    fun `get returns snapshot when key exists with all required fields`() {
        val previewId = "p-4"
        val key = "storybook:tts:preview:$previewId"
        `when`(hashOps.entries(key)).thenReturn(
            mapOf(
                "userId" to "7",
                "voiceProfileId" to "42",
                "status" to "SUCCESS",
                "audioUrl" to "https://s3/preview.wav",
                "createdAt" to "2026-04-30T12:00:00Z",
                "finishedAt" to "2026-04-30T12:00:08Z",
            )
        )

        val snapshot = repo.get(previewId)

        assertThat(snapshot).isNotNull
        assertThat(snapshot!!.previewId).isEqualTo(previewId)
        assertThat(snapshot.userId).isEqualTo(7L)
        assertThat(snapshot.voiceProfileId).isEqualTo(42L)
        assertThat(snapshot.status).isEqualTo(JobStatus.SUCCESS)
        assertThat(snapshot.audioUrl).isEqualTo("https://s3/preview.wav")
        assertThat(snapshot.createdAt).isEqualTo(Instant.parse("2026-04-30T12:00:00Z"))
        assertThat(snapshot.finishedAt).isEqualTo(Instant.parse("2026-04-30T12:00:08Z"))
    }

    @Test
    fun `get returns null when key missing`() {
        val previewId = "p-missing"
        val key = "storybook:tts:preview:$previewId"
        `when`(hashOps.entries(key)).thenReturn(emptyMap())

        assertThat(repo.get(previewId)).isNull()
    }

    @Test
    fun `get parses FAILED snapshot with errorCode and errorMessage`() {
        val previewId = "p-failed"
        val key = "storybook:tts:preview:$previewId"
        `when`(hashOps.entries(key)).thenReturn(
            mapOf(
                "userId" to "7",
                "voiceProfileId" to "42",
                "status" to "FAILED",
                "errorCode" to "TTS_INFER_FAILED",
                "errorMessage" to "GPU OOM",
                "createdAt" to "2026-04-30T12:00:00Z",
                "finishedAt" to "2026-04-30T12:00:02Z",
            )
        )

        val snapshot = repo.get(previewId)
        assertThat(snapshot!!.status).isEqualTo(JobStatus.FAILED)
        assertThat(snapshot.errorCode).isEqualTo("TTS_INFER_FAILED")
        assertThat(snapshot.errorMessage).isEqualTo("GPU OOM")
        assertThat(snapshot.audioUrl).isNull()
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd app/backend && ./gradlew test --tests 'com.s210.backend.common.redis.TtsPreviewRedisRepositoryTest'
```

Expected: 컴파일 실패 — `TtsPreviewRedisRepository`, `TtsPreviewSnapshot` 미정의.

- [ ] **Step 3: 최소 구현 작성**

`app/backend/src/main/kotlin/com/s210/backend/common/redis/TtsPreviewRedisRepository.kt`:

```kotlin
package com.s210.backend.common.redis

import com.s210.backend.domain.job.model.JobStatus
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Repository
import java.time.Duration
import java.time.Instant

/**
 * TTS preview 잡의 correlation/state 저장소.
 *
 * Redis Key: `storybook:tts:preview:{previewId}` (Hash, TTL 1시간)
 *
 * preview 는 영속 가치가 거의 없는 일회성 작업이므로 `story_generation_jobs` (MySQL) 에
 * row 를 만들지 않고 Redis Hash 로 발급/상태/결과를 관리한다.
 *
 * 필드:
 *  - userId, voiceProfileId — 인가/디버깅
 *  - status — PENDING / SUCCESS / FAILED (RUNNING 미사용)
 *  - audioUrl — SUCCESS 시
 *  - errorCode, errorMessage — FAILED 시
 *  - createdAt, finishedAt — ISO8601
 */
@Repository
class TtsPreviewRedisRepository(
    private val redis: StringRedisTemplate,
) {
    companion object {
        const val KEY_PREFIX = "storybook:tts:preview"
        val TTL: Duration = Duration.ofHours(1)
    }

    fun createPending(previewId: String, userId: Long, voiceProfileId: Long) {
        val key = key(previewId)
        val now = Instant.now().toString()
        val fields = mapOf(
            "userId" to userId.toString(),
            "voiceProfileId" to voiceProfileId.toString(),
            "status" to JobStatus.PENDING.name,
            "createdAt" to now,
        )
        redis.opsForHash<String, String>().putAll(key, fields)
        redis.expire(key, TTL)
    }

    fun markSuccess(previewId: String, audioUrl: String) {
        val key = key(previewId)
        val fields = mapOf(
            "status" to JobStatus.SUCCESS.name,
            "audioUrl" to audioUrl,
            "finishedAt" to Instant.now().toString(),
        )
        redis.opsForHash<String, String>().putAll(key, fields)
        redis.expire(key, TTL)
    }

    fun markFailed(previewId: String, errorCode: String, errorMessage: String) {
        val key = key(previewId)
        val fields = mapOf(
            "status" to JobStatus.FAILED.name,
            "errorCode" to errorCode,
            "errorMessage" to errorMessage,
            "finishedAt" to Instant.now().toString(),
        )
        redis.opsForHash<String, String>().putAll(key, fields)
        redis.expire(key, TTL)
    }

    fun get(previewId: String): TtsPreviewSnapshot? {
        val map = redis.opsForHash<String, String>().entries(key(previewId))
        if (map.isEmpty()) return null
        val statusStr = map["status"] ?: return null
        val userIdStr = map["userId"] ?: return null
        val voiceProfileIdStr = map["voiceProfileId"] ?: return null
        val createdAtStr = map["createdAt"] ?: return null
        return TtsPreviewSnapshot(
            previewId = previewId,
            userId = userIdStr.toLong(),
            voiceProfileId = voiceProfileIdStr.toLong(),
            status = JobStatus.valueOf(statusStr),
            audioUrl = map["audioUrl"],
            errorCode = map["errorCode"],
            errorMessage = map["errorMessage"],
            createdAt = Instant.parse(createdAtStr),
            finishedAt = map["finishedAt"]?.let(Instant::parse),
        )
    }

    private fun key(previewId: String): String = "$KEY_PREFIX:$previewId"
}

data class TtsPreviewSnapshot(
    val previewId: String,
    val userId: Long,
    val voiceProfileId: Long,
    val status: JobStatus,
    val audioUrl: String?,
    val errorCode: String?,
    val errorMessage: String?,
    val createdAt: Instant,
    val finishedAt: Instant?,
)
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
./gradlew test --tests 'com.s210.backend.common.redis.TtsPreviewRedisRepositoryTest'
```

Expected: 6개 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/common/redis/TtsPreviewRedisRepository.kt \
        app/backend/src/test/kotlin/com/s210/backend/common/redis/TtsPreviewRedisRepositoryTest.kt
git commit -m "feat(tts): add TtsPreviewRedisRepository for preview correlation"
```

---

## Task 2: VoicePreviewService 재작성 (Redis 기반) + Controller pass-through 갱신

**Files:**
- Modify: `app/backend/src/main/kotlin/com/s210/backend/domain/tts/application/VoicePreviewService.kt`
- Modify: `app/backend/src/test/kotlin/com/s210/backend/domain/tts/application/VoicePreviewServiceTest.kt`
- Create: `app/backend/src/main/kotlin/com/s210/backend/domain/tts/presentation/response/TtsPreviewStatusResponse.kt`
- Modify: `app/backend/src/main/kotlin/com/s210/backend/domain/voice/presentation/response/VoiceResponse.kt` (필드 jobId→previewId)
- Modify: `app/backend/src/main/kotlin/com/s210/backend/domain/voice/presentation/VoiceController.kt` (POST 응답 pass-through만 — GET 핸들러는 Task 4 에서)

- [ ] **Step 1: 기존 테스트를 Redis 기반으로 재작성 (실패 상태로)**

`app/backend/src/test/kotlin/com/s210/backend/domain/tts/application/VoicePreviewServiceTest.kt` 전체 교체:

```kotlin
package com.s210.backend.domain.tts.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.common.redis.TtsPreviewRedisRepository
import com.s210.backend.domain.tts.application.dto.TtsPreviewJobMessage
import com.s210.backend.domain.voice.entity.VoiceProfile
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.amqp.rabbit.core.RabbitTemplate
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class VoicePreviewServiceTest {

    private val voiceProfileRepository: VoiceProfileRepository = mock(VoiceProfileRepository::class.java)
    private val previewRedis: TtsPreviewRedisRepository = mock(TtsPreviewRedisRepository::class.java)
    private val rabbitTemplate: RabbitTemplate = mock(RabbitTemplate::class.java)
    private val ttsService = TtsService(rabbitTemplate)

    private val service = VoicePreviewService(
        voiceProfileRepository = voiceProfileRepository,
        previewRedis = previewRedis,
        ttsService = ttsService,
    )

    private fun voiceProfile(
        id: Long = 42L,
        userId: Long = 7L,
        audioUrl: String? = "stories/voice/7/reference.wav",
    ) = VoiceProfile(
        id = id,
        userId = userId,
        title = "sample",
        audioUrl = audioUrl,
    )

    @Test
    fun `preview rejects blank text`() {
        assertThatThrownBy { service.preview(7L, 42L, "   ") }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.INVALID_REQUEST)
            }
    }

    @Test
    fun `preview rejects another user's voice profile`() {
        `when`(voiceProfileRepository.findByIdAndDeletedAtIsNull(42L)).thenReturn(voiceProfile(userId = 99L))

        assertThatThrownBy { service.preview(7L, 42L, "Hello world") }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.FORBIDDEN)
            }
    }

    @Test
    fun `preview rejects voice profile without audio source`() {
        `when`(voiceProfileRepository.findByIdAndDeletedAtIsNull(42L)).thenReturn(voiceProfile(audioUrl = null))

        assertThatThrownBy { service.preview(7L, 42L, "Hello world") }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.INVALID_REQUEST)
            }
    }

    @Test
    fun `preview creates Redis pending entry and publishes message with previewId as jobId`() {
        val profile = voiceProfile()
        `when`(voiceProfileRepository.findByIdAndDeletedAtIsNull(42L)).thenReturn(profile)

        val previewId = service.preview(
            userId = 7L,
            voiceProfileId = 42L,
            text = "Hello world",
            emotion = "NEUTRAL",
            language = "ko-KR",
        )

        // 반환값은 UUID 형식
        assertThat(previewId).isNotBlank()
        assertThat(UUID.fromString(previewId)).isNotNull()

        // Redis createPending 호출 검증
        verify(previewRedis).createPending(
            previewId = previewId,
            userId = 7L,
            voiceProfileId = 42L,
        )

        // RabbitMQ publish 검증
        val exchangeCaptor = ArgumentCaptor.forClass(String::class.java)
        val routingKeyCaptor = ArgumentCaptor.forClass(String::class.java)
        val messageCaptor = ArgumentCaptor.forClass(Any::class.java)
        verify(rabbitTemplate).convertAndSend(exchangeCaptor.capture(), routingKeyCaptor.capture(), messageCaptor.capture())
        assertThat(exchangeCaptor.value).isEqualTo(RabbitMQConfig.REQUEST_EXCHANGE)
        assertThat(routingKeyCaptor.value).isEqualTo(RoutingKeys.TTS_PREVIEW)
        val message = messageCaptor.value as TtsPreviewJobMessage
        assertThat(message.jobId).isEqualTo(previewId)
        assertThat(message.voiceId).isEqualTo("42")
        assertThat(message.payload.text).isEqualTo("Hello world")
        assertThat(message.payload.language).isEqualTo("ko-KR")
        assertThat(message.payload.referenceAudioS3Key).isEqualTo("stories/voice/7/reference.wav")
        assertThat(message.payload.referenceAudioUrl).isNull()
        assertThat(message.payload.options.emotion).isEqualTo("NEUTRAL")
    }

    @Test
    fun `getStatus returns response from snapshot when caller owns the preview`() {
        val previewId = UUID.randomUUID().toString()
        val createdAt = java.time.Instant.parse("2026-04-30T12:00:00Z")
        val finishedAt = java.time.Instant.parse("2026-04-30T12:00:08Z")
        `when`(previewRedis.get(previewId)).thenReturn(
            com.s210.backend.common.redis.TtsPreviewSnapshot(
                previewId = previewId,
                userId = 7L,
                voiceProfileId = 42L,
                status = com.s210.backend.domain.job.model.JobStatus.SUCCESS,
                audioUrl = "https://s3/preview.wav",
                errorCode = null,
                errorMessage = null,
                createdAt = createdAt,
                finishedAt = finishedAt,
            )
        )

        val response = service.getStatus(userId = 7L, previewId = previewId)

        assertThat(response.previewId).isEqualTo(previewId)
        assertThat(response.status).isEqualTo("SUCCESS")
        assertThat(response.audioUrl).isEqualTo("https://s3/preview.wav")
        assertThat(response.createdAt).isEqualTo(createdAt)
        assertThat(response.finishedAt).isEqualTo(finishedAt)
    }

    @Test
    fun `getStatus throws NOT_FOUND when previewId missing or expired`() {
        val previewId = UUID.randomUUID().toString()
        `when`(previewRedis.get(previewId)).thenReturn(null)

        assertThatThrownBy { service.getStatus(userId = 7L, previewId = previewId) }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.NOT_FOUND)
            }
    }

    @Test
    fun `getStatus throws FORBIDDEN when caller is not the owner`() {
        val previewId = UUID.randomUUID().toString()
        `when`(previewRedis.get(previewId)).thenReturn(
            com.s210.backend.common.redis.TtsPreviewSnapshot(
                previewId = previewId,
                userId = 99L,
                voiceProfileId = 42L,
                status = com.s210.backend.domain.job.model.JobStatus.PENDING,
                audioUrl = null,
                errorCode = null,
                errorMessage = null,
                createdAt = java.time.Instant.now(),
                finishedAt = null,
            )
        )

        assertThatThrownBy { service.getStatus(userId = 7L, previewId = previewId) }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.FORBIDDEN)
            }
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
./gradlew test --tests 'com.s210.backend.domain.tts.application.VoicePreviewServiceTest'
```

Expected: 컴파일 실패 — `VoicePreviewService` 시그니처 불일치 (`previewRedis` 인자 없음, `getStatus` 메서드 없음, `TtsPreviewStatusResponse` 미정의).

- [ ] **Step 3: TtsPreviewStatusResponse 신규 작성**

`app/backend/src/main/kotlin/com/s210/backend/domain/tts/presentation/response/TtsPreviewStatusResponse.kt`:

```kotlin
package com.s210.backend.domain.tts.presentation.response

import com.s210.backend.common.redis.TtsPreviewSnapshot
import java.time.Instant

data class TtsPreviewStatusResponse(
    val previewId: String,
    val status: String,
    val audioUrl: String?,
    val errorCode: String?,
    val errorMessage: String?,
    val createdAt: Instant,
    val finishedAt: Instant?,
) {
    companion object {
        fun from(snapshot: TtsPreviewSnapshot) = TtsPreviewStatusResponse(
            previewId = snapshot.previewId,
            status = snapshot.status.name,
            audioUrl = snapshot.audioUrl,
            errorCode = snapshot.errorCode,
            errorMessage = snapshot.errorMessage,
            createdAt = snapshot.createdAt,
            finishedAt = snapshot.finishedAt,
        )
    }
}
```

- [ ] **Step 4: VoicePreviewService 재작성**

`app/backend/src/main/kotlin/com/s210/backend/domain/tts/application/VoicePreviewService.kt` 전체 교체:

```kotlin
package com.s210.backend.domain.tts.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.redis.TtsPreviewRedisRepository
import com.s210.backend.domain.tts.application.dto.TtsPreviewJobMessage
import com.s210.backend.domain.tts.application.dto.VoicePreviewOptions
import com.s210.backend.domain.tts.application.dto.VoicePreviewRequest
import com.s210.backend.domain.tts.presentation.response.TtsPreviewStatusResponse
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * 보이스 클론 미리듣기 — BE → AI 비동기 RabbitMQ 호출.
 *
 * 흐름:
 *  1. 소유권 검증 (다른 user 의 voice profile 거부)
 *  2. voice_profiles.audio_url 으로부터 referenceAudioS3Key / referenceAudioUrl 결정
 *  3. previewId (UUID) 발급 + Redis HSET (PENDING)
 *  4. RabbitMQ 로 미리듣기 요청 publish (jobId = previewId)
 *  5. previewId 반환 → FE 는 GET /api/voice-profiles/previews/{previewId} 로 polling
 */
@Service
class VoicePreviewService(
    private val voiceProfileRepository: VoiceProfileRepository,
    private val previewRedis: TtsPreviewRedisRepository,
    private val ttsService: TtsService,
) {
    fun preview(
        userId: Long,
        voiceProfileId: Long,
        text: String,
        emotion: String? = null,
        language: String = "en-US",
    ): String {
        if (text.isBlank() || text.length > 500) {
            throw BusinessException(VoiceErrorCode.INVALID_REQUEST)
        }
        val vp = voiceProfileRepository.findByIdAndDeletedAtIsNull(voiceProfileId)
            ?: throw BusinessException(VoiceErrorCode.NOT_FOUND)
        if (vp.userId != userId) {
            throw BusinessException(VoiceErrorCode.FORBIDDEN)
        }
        val referenceSource = vp.audioUrl ?: throw BusinessException(VoiceErrorCode.INVALID_REQUEST)

        val previewId = UUID.randomUUID().toString()
        previewRedis.createPending(previewId = previewId, userId = userId, voiceProfileId = voiceProfileId)

        ttsService.publishPreview(
            TtsPreviewJobMessage(
                jobId = previewId,
                voiceId = voiceProfileId.toString(),
                payload = VoicePreviewRequest(
                    text = text,
                    language = language,
                    options = VoicePreviewOptions(emotion = emotion ?: "NEUTRAL"),
                    referenceAudioUrl = referenceSource.takeUnless(::looksLikeS3Key),
                    referenceAudioS3Key = referenceSource.takeIf(::looksLikeS3Key),
                ),
            ),
        )

        return previewId
    }

    fun getStatus(userId: Long, previewId: String): TtsPreviewStatusResponse {
        val snapshot = previewRedis.get(previewId)
            ?: throw BusinessException(VoiceErrorCode.NOT_FOUND)
        if (snapshot.userId != userId) {
            throw BusinessException(VoiceErrorCode.FORBIDDEN)
        }
        return TtsPreviewStatusResponse.from(snapshot)
    }

    private fun looksLikeS3Key(value: String): Boolean = value.startsWith("stories/") || value.startsWith("voices/")
}
```

- [ ] **Step 5: VoicePreviewJobResponse 필드명 변경 (컴파일 깨짐 방지)**

`app/backend/src/main/kotlin/com/s210/backend/domain/voice/presentation/response/VoiceResponse.kt` 의 `VoicePreviewJobResponse` 부분 교체:

```kotlin
data class VoicePreviewJobResponse(
    val previewId: String,
    val jobType: String = "TTS_PREVIEW",
    val status: String = "PENDING",
)
```

- [ ] **Step 6: VoiceController.voiceProfilePreview 의 반환 코드 갱신**

`app/backend/src/main/kotlin/com/s210/backend/domain/voice/presentation/VoiceController.kt` 의 기존 `voiceProfilePreview` 메서드 본문 갱신 (반환 변수명만 — GET 핸들러는 Task 4 에서 추가):

```kotlin
    @PostMapping("/voice-profiles/{voiceProfileId}/preview")
    fun voiceProfilePreview(
        @PathVariable voiceProfileId: Long,
        @RequestBody request: VoicePreviewApiRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<VoicePreviewJobResponse>> {
        val previewId = voicePreviewService.preview(
            userId = user.userId,
            voiceProfileId = voiceProfileId,
            text = request.text,
            emotion = request.emotion,
            language = request.language,
        )
        return ResponseEntity
            .accepted()
            .body(ApiResponse(data = VoicePreviewJobResponse(previewId = previewId)))
    }
```

- [ ] **Step 7: 컴파일 + 테스트 통과 확인**

```bash
./gradlew compileKotlin compileTestKotlin
./gradlew test --tests 'com.s210.backend.domain.tts.application.VoicePreviewServiceTest'
```

Expected: 컴파일 성공 (TtsResultHandler 는 아직 옛 형태 — Task 3 에서 교체. 이 시점엔 main 코드의 preview 경로가 service-only 로 동작 가능). VoicePreviewServiceTest 7개 PASS.

> **참고**: TtsResultHandler 는 여전히 옛 jobRepository 기반 preview 처리를 하므로, 만약 결과 envelope 가 들어오면 "Unknown TTS jobId" 같은 로그가 나오겠지만 컴파일은 정상.

- [ ] **Step 8: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/tts/application/VoicePreviewService.kt \
        app/backend/src/main/kotlin/com/s210/backend/domain/tts/presentation/response/TtsPreviewStatusResponse.kt \
        app/backend/src/main/kotlin/com/s210/backend/domain/voice/presentation/response/VoiceResponse.kt \
        app/backend/src/main/kotlin/com/s210/backend/domain/voice/presentation/VoiceController.kt \
        app/backend/src/test/kotlin/com/s210/backend/domain/tts/application/VoicePreviewServiceTest.kt
git commit -m "refactor(tts): VoicePreviewService uses Redis correlation"
```

---

## Task 3: TtsResultHandler.handle(PreviewTtsResultEnvelope) 재작성

**Files:**
- Modify: `app/backend/src/main/kotlin/com/s210/backend/domain/tts/application/TtsResultHandler.kt`
- Modify: `app/backend/src/test/kotlin/com/s210/backend/domain/tts/application/TtsResultHandlerTest.kt`

- [ ] **Step 1: TtsResultHandlerTest 에 preview 케이스 4개 추가 (실패 상태로)**

`app/backend/src/test/kotlin/com/s210/backend/domain/tts/application/TtsResultHandlerTest.kt` 의 마지막 `}` 직전에 추가하고, 클래스 상단의 필드/생성자에 `previewRedis` 추가:

먼저 클래스 헤더에서 mock + 생성자 인자 추가:

```kotlin
    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val sceneRepository: SceneRepository = mock(SceneRepository::class.java)
    private val sceneSentenceRepository: SceneSentenceRepository = mock(SceneSentenceRepository::class.java)
    private val ttsCacheService: TtsCacheService = mock(TtsCacheService::class.java)
    private val jobStatusRepo: JobStatusRedisRepository = mock(JobStatusRedisRepository::class.java)
    private val previewRedis: com.s210.backend.common.redis.TtsPreviewRedisRepository =
        mock(com.s210.backend.common.redis.TtsPreviewRedisRepository::class.java)
    private val objectMapper = jacksonObjectMapper()

    private val handler = TtsResultHandler(
        jobRepository = jobRepository,
        sceneRepository = sceneRepository,
        sceneSentenceRepository = sceneSentenceRepository,
        ttsCacheService = ttsCacheService,
        jobStatusRepo = jobStatusRepo,
        previewRedis = previewRedis,
        objectMapper = objectMapper,
    )
```

그리고 클래스 마지막에 preview 테스트 4개 추가:

```kotlin
    // -----------------------------------------------------------------------
    // Preview: COMPLETED → markSuccess
    // -----------------------------------------------------------------------

    @Test
    fun `preview COMPLETED calls markSuccess with audioUrl from payload`() {
        val previewId = "p-success"
        `when`(previewRedis.get(previewId)).thenReturn(
            com.s210.backend.common.redis.TtsPreviewSnapshot(
                previewId = previewId,
                userId = 7L,
                voiceProfileId = 42L,
                status = JobStatus.PENDING,
                audioUrl = null,
                errorCode = null,
                errorMessage = null,
                createdAt = java.time.Instant.now(),
                finishedAt = null,
            )
        )
        val envelope = com.s210.backend.domain.tts.application.dto.PreviewTtsResultEnvelope(
            jobId = previewId,
            type = "tts.preview.result",
            status = "COMPLETED",
            payload = com.s210.backend.domain.tts.application.dto.PreviewTtsResultPayload(
                voiceId = "42",
                audioUrl = "https://s3/preview.wav",
                durationMs = 1200,
                format = "wav",
            ),
        )

        handler.handle(envelope)

        verify(previewRedis).markSuccess(previewId, "https://s3/preview.wav")
        verify(jobRepository, never()).findById(anyLong())
    }

    @Test
    fun `preview FAILED calls markFailed with code and message from envelope error`() {
        val previewId = "p-failed"
        `when`(previewRedis.get(previewId)).thenReturn(
            com.s210.backend.common.redis.TtsPreviewSnapshot(
                previewId = previewId,
                userId = 7L,
                voiceProfileId = 42L,
                status = JobStatus.PENDING,
                audioUrl = null,
                errorCode = null,
                errorMessage = null,
                createdAt = java.time.Instant.now(),
                finishedAt = null,
            )
        )
        val envelope = com.s210.backend.domain.tts.application.dto.PreviewTtsResultEnvelope(
            jobId = previewId,
            type = "tts.preview.result",
            status = "FAILED",
            error = com.s210.backend.domain.storyboard.application.dto.AiError(code = "TTS_INFER_FAILED", message = "GPU OOM"),
        )

        handler.handle(envelope)

        verify(previewRedis).markFailed(previewId, "TTS_INFER_FAILED", "GPU OOM")
    }

    @Test
    fun `preview COMPLETED with null payload calls markFailed with PAYLOAD_MISSING`() {
        val previewId = "p-null-payload"
        `when`(previewRedis.get(previewId)).thenReturn(
            com.s210.backend.common.redis.TtsPreviewSnapshot(
                previewId = previewId,
                userId = 7L,
                voiceProfileId = 42L,
                status = JobStatus.PENDING,
                audioUrl = null,
                errorCode = null,
                errorMessage = null,
                createdAt = java.time.Instant.now(),
                finishedAt = null,
            )
        )
        val envelope = com.s210.backend.domain.tts.application.dto.PreviewTtsResultEnvelope(
            jobId = previewId,
            type = "tts.preview.result",
            status = "COMPLETED",
            payload = null,
        )

        handler.handle(envelope)

        verify(previewRedis).markFailed(
            org.mockito.ArgumentMatchers.eq(previewId),
            org.mockito.ArgumentMatchers.eq("PAYLOAD_MISSING"),
            anyString(),
        )
    }

    @Test
    fun `preview unknown previewId logs warn and skips redis writes`() {
        val previewId = "p-missing"
        `when`(previewRedis.get(previewId)).thenReturn(null)
        val envelope = com.s210.backend.domain.tts.application.dto.PreviewTtsResultEnvelope(
            jobId = previewId,
            type = "tts.preview.result",
            status = "COMPLETED",
            payload = com.s210.backend.domain.tts.application.dto.PreviewTtsResultPayload(
                voiceId = "42",
                audioUrl = "https://s3/preview.wav",
                durationMs = 1200,
                format = "wav",
            ),
        )

        handler.handle(envelope)

        verify(previewRedis, never()).markSuccess(anyString(), anyString())
        verify(previewRedis, never()).markFailed(anyString(), anyString(), anyString())
    }
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
./gradlew test --tests 'com.s210.backend.domain.tts.application.TtsResultHandlerTest'
```

Expected: 컴파일 실패 — `TtsResultHandler` 생성자에 `previewRedis` 인자 없음.

- [ ] **Step 3: TtsResultHandler 수정 — preview 부분만 교체**

`app/backend/src/main/kotlin/com/s210/backend/domain/tts/application/TtsResultHandler.kt` 변경:

생성자 인자 추가:

```kotlin
@Component
class TtsResultHandler(
    private val jobRepository: StoryGenerationJobRepository,
    private val sceneRepository: SceneRepository,
    private val sceneSentenceRepository: SceneSentenceRepository,
    private val ttsCacheService: TtsCacheService,
    private val jobStatusRepo: JobStatusRedisRepository,
    private val previewRedis: com.s210.backend.common.redis.TtsPreviewRedisRepository,
    private val objectMapper: ObjectMapper,
) {
```

기존 `fun handle(envelope: PreviewTtsResultEnvelope)` 와 `private fun handlePreviewCompleted(...)` 를 다음으로 교체:

```kotlin
    fun handle(envelope: PreviewTtsResultEnvelope) {
        val previewId = envelope.jobId
        val snapshot = previewRedis.get(previewId)
        if (snapshot == null) {
            log.warn("Unknown TTS_PREVIEW previewId: {}", previewId)
            return
        }
        if (snapshot.status == JobStatus.SUCCESS || snapshot.status == JobStatus.FAILED) {
            log.info("TTS_PREVIEW {} already finalized ({}), skip", previewId, snapshot.status)
            return
        }

        when (envelope.status.uppercase()) {
            "COMPLETED" -> {
                val payload = envelope.payload
                if (payload == null) {
                    log.warn("TTS_PREVIEW COMPLETED with null payload, previewId={}", previewId)
                    previewRedis.markFailed(previewId, "PAYLOAD_MISSING", "AI 응답에 payload가 없습니다.")
                    return
                }
                previewRedis.markSuccess(previewId, payload.audioUrl)
                log.info("TTS_PREVIEW {} SUCCESS", previewId)
            }
            "FAILED" -> {
                val code = envelope.error?.code ?: "UNKNOWN"
                val msg = envelope.error?.message ?: "(unknown)"
                previewRedis.markFailed(previewId, code, msg)
            }
            else -> log.warn("Unknown TTS_PREVIEW envelope status: {}", envelope.status)
        }
    }
```

> 기존 `handlePreviewCompleted` 메서드는 위에 인라인으로 흡수됐으니 함수 정의를 통째로 삭제.

- [ ] **Step 4: 테스트 통과 확인**

```bash
./gradlew test --tests 'com.s210.backend.domain.tts.application.TtsResultHandlerTest'
```

Expected: 기존 8개 + 신규 4개 = 12개 PASS.

- [ ] **Step 5: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/tts/application/TtsResultHandler.kt \
        app/backend/src/test/kotlin/com/s210/backend/domain/tts/application/TtsResultHandlerTest.kt
git commit -m "refactor(tts): preview result handler writes to Redis instead of DB"
```

---

## Task 4: GET /voice-profiles/previews/{previewId} 엔드포인트 추가

**Files:**
- Modify: `app/backend/src/main/kotlin/com/s210/backend/domain/voice/presentation/VoiceController.kt` (GET 핸들러 추가)
- Create: `app/backend/src/test/kotlin/com/s210/backend/domain/voice/presentation/VoiceControllerPreviewStatusTest.kt`

- [ ] **Step 1: 엔드포인트 단위 테스트 작성 (실패 상태로)**

`app/backend/src/test/kotlin/com/s210/backend/domain/voice/presentation/VoiceControllerPreviewStatusTest.kt`:

```kotlin
package com.s210.backend.domain.voice.presentation

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.redis.TtsPreviewRedisRepository
import com.s210.backend.common.redis.TtsPreviewSnapshot
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.tts.application.TtsService
import com.s210.backend.domain.tts.application.VoicePreviewService
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.amqp.rabbit.core.RabbitTemplate
import java.time.Instant
import java.util.UUID

/**
 * VoicePreviewService.getStatus 의 권한/존재 검증을 단위 테스트로 검증.
 *
 * Controller 자체는 thin pass-through 라 별도 MockMvc 통합 테스트는 생략.
 * (controller -> service 호출만 확인하면 충분)
 */
@ExtendWith(MockitoExtension::class)
class VoiceControllerPreviewStatusTest {

    private val voiceProfileRepository: VoiceProfileRepository = mock(VoiceProfileRepository::class.java)
    private val previewRedis: TtsPreviewRedisRepository = mock(TtsPreviewRedisRepository::class.java)
    private val rabbitTemplate: RabbitTemplate = mock(RabbitTemplate::class.java)
    private val ttsService = TtsService(rabbitTemplate)

    private val service = VoicePreviewService(
        voiceProfileRepository = voiceProfileRepository,
        previewRedis = previewRedis,
        ttsService = ttsService,
    )

    @Test
    fun `getStatus returns SUCCESS payload`() {
        val previewId = UUID.randomUUID().toString()
        val createdAt = Instant.parse("2026-04-30T12:00:00Z")
        val finishedAt = Instant.parse("2026-04-30T12:00:08Z")
        `when`(previewRedis.get(previewId)).thenReturn(
            TtsPreviewSnapshot(
                previewId = previewId,
                userId = 7L,
                voiceProfileId = 42L,
                status = JobStatus.SUCCESS,
                audioUrl = "https://s3/preview.wav",
                errorCode = null,
                errorMessage = null,
                createdAt = createdAt,
                finishedAt = finishedAt,
            )
        )

        val res = service.getStatus(userId = 7L, previewId = previewId)

        assertThat(res.status).isEqualTo("SUCCESS")
        assertThat(res.audioUrl).isEqualTo("https://s3/preview.wav")
        assertThat(res.createdAt).isEqualTo(createdAt)
        assertThat(res.finishedAt).isEqualTo(finishedAt)
    }

    @Test
    fun `getStatus 404 when previewId missing`() {
        val previewId = UUID.randomUUID().toString()
        `when`(previewRedis.get(previewId)).thenReturn(null)

        assertThatThrownBy { service.getStatus(userId = 7L, previewId = previewId) }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.NOT_FOUND)
            }
    }

    @Test
    fun `getStatus 403 when caller is not owner`() {
        val previewId = UUID.randomUUID().toString()
        `when`(previewRedis.get(previewId)).thenReturn(
            TtsPreviewSnapshot(
                previewId = previewId,
                userId = 99L,
                voiceProfileId = 42L,
                status = JobStatus.PENDING,
                audioUrl = null,
                errorCode = null,
                errorMessage = null,
                createdAt = Instant.now(),
                finishedAt = null,
            )
        )

        assertThatThrownBy { service.getStatus(userId = 7L, previewId = previewId) }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.FORBIDDEN)
            }
    }
}
```

- [ ] **Step 2: 테스트 실패 확인 (예상 실패 사유: 컴파일은 되는데 service 가 이미 Task 2 에서 만들어졌으니 PASS 일 가능성)**

```bash
./gradlew test --tests 'com.s210.backend.domain.voice.presentation.VoiceControllerPreviewStatusTest'
```

Expected: 3개 PASS — Task 2 의 service 구현 덕분. (이 테스트는 service 검증의 보강이며, Task 2 의 동등 테스트가 다른 패키지에 별도로 존재하는 것이 의도임 — controller 변경의 회귀 방지용 안전망)

- [ ] **Step 3: VoiceController 에 GET 핸들러 추가**

`app/backend/src/main/kotlin/com/s210/backend/domain/voice/presentation/VoiceController.kt`:

상단 import 블록에 추가:

```kotlin
import com.s210.backend.domain.tts.presentation.response.TtsPreviewStatusResponse
```

`voiceProfilePreview` 메서드 아래에 추가:

```kotlin
    @GetMapping("/voice-profiles/previews/{previewId}")
    fun voicePreviewStatus(
        @PathVariable previewId: String,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<TtsPreviewStatusResponse>> {
        val response = voicePreviewService.getStatus(user.userId, previewId)
        return ResponseEntity.ok(ApiResponse(data = response))
    }
```

- [ ] **Step 4: 빌드 + 전체 단위 테스트**

```bash
./gradlew compileKotlin compileTestKotlin
./gradlew test --tests 'com.s210.backend.domain.voice.*' --tests 'com.s210.backend.domain.tts.*' --tests 'com.s210.backend.common.redis.*'
```

Expected: 컴파일 성공, 모든 voice/tts/redis 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/voice/presentation/VoiceController.kt \
        app/backend/src/test/kotlin/com/s210/backend/domain/voice/presentation/VoiceControllerPreviewStatusTest.kt
git commit -m "feat(voice): add GET /voice-profiles/previews/{previewId} endpoint"
```

---

## Task 5: Dead code 제거 — JobType.TTS_PREVIEW + JobService preview 분기

**Files:**
- Modify: `app/backend/src/main/kotlin/com/s210/backend/domain/job/model/JobType.kt`
- Modify: `app/backend/src/main/kotlin/com/s210/backend/domain/job/application/JobService.kt`
- Modify: `app/backend/src/test/kotlin/com/s210/backend/domain/job/presentation/JobControllerPollingTest.kt`

- [ ] **Step 1: JobControllerPollingTest 의 preview 케이스 삭제 + 시그니처 정리**

`app/backend/src/test/kotlin/com/s210/backend/domain/job/presentation/JobControllerPollingTest.kt`:

다음 두 가지 작업:

**(a) `preview job checks ownership using voice profile` 테스트 메서드 통째로 삭제** (`@Test` 부터 닫는 `}` 까지).

**(b) 클래스 상단에서 `voiceProfileRepository` 필드와 service 생성자 인자 삭제:**

기존:
```kotlin
    private val voiceProfileRepository: VoiceProfileRepository = mock(VoiceProfileRepository::class.java)
    ...
    private val service = JobService(
        jobRepository = jobRepository,
        storyRepository = storyRepository,
        voiceProfileRepository = voiceProfileRepository,
        objectMapper = objectMapper,
        jobStatusRedisRepository = jobStatusRedisRepo,
    )
```

변경:
```kotlin
    private val service = JobService(
        jobRepository = jobRepository,
        storyRepository = storyRepository,
        objectMapper = objectMapper,
        jobStatusRedisRepository = jobStatusRedisRepo,
    )
```

`VoiceProfile`, `VoiceProfileRepository`, `JobType` (만약 다른 곳에서 안 쓰면) import 도 제거.

- [ ] **Step 2: JobType 에서 TTS_PREVIEW 멤버 삭제**

`app/backend/src/main/kotlin/com/s210/backend/domain/job/model/JobType.kt`:

`TTS_PREVIEW` enum 멤버와 그 위 KDoc 주석 라인 삭제:

```kotlin
    /** 스토리보드 줄거리(요약) 생성 작업 — V9 ENUM 추가. */
    STORYBOARD_STORY_SUMMARY,
}
```

- [ ] **Step 3: JobService 의 preview 분기 + 의존 정리**

`app/backend/src/main/kotlin/com/s210/backend/domain/job/application/JobService.kt`:

생성자에서 `voiceProfileRepository` 와 `objectMapper` 제거 (objectMapper 가 다른 곳에 안 쓰이는지 확인 필요. `requestPayload.toJsonNodeOrNull()` 와 `resultPayload.toJsonNodeOrNull()` 에서 사용되니 **objectMapper 는 보존**, voiceProfileRepository 만 제거):

```kotlin
@Service
@Transactional(readOnly = true)
class JobService(
    private val jobRepository: StoryGenerationJobRepository,
    private val storyRepository: StoryRepository,
    private val objectMapper: ObjectMapper,
    private val jobStatusRedisRepository: JobStatusRedisRepository,
) {
```

`assertOwned` 함수에서 preview 분기 삭제:

```kotlin
    private fun assertOwned(userId: Long, job: StoryGenerationJob) {
        val story = storyRepository.findById(job.storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.userId != userId) {
            throw BusinessException(CommonErrorCode.FORBIDDEN)
        }
    }
```

`assertPreviewOwned` private 메서드 통째로 삭제. 미사용이 된 `JobType` import 도 제거 (`toResponse` 안에서 `jobType.name` 으로는 여전히 사용하므로 import 보존).

미사용이 된 `VoiceProfileRepository`, `BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)` 의 일부 사용처도 검토하고 import 정리. (`assertOwned` 의 STORY_NOT_FOUND 에서는 그대로 사용.)

- [ ] **Step 4: 컴파일 + 테스트**

```bash
./gradlew compileKotlin compileTestKotlin
./gradlew test --tests 'com.s210.backend.domain.job.*'
```

Expected: 컴파일 성공, JobControllerPollingTest 의 남은 3개 테스트 PASS.

- [ ] **Step 5: 전체 단위 테스트**

```bash
./gradlew test
```

Expected: 모든 테스트 PASS. (다른 곳에서 `JobType.TTS_PREVIEW` 를 참조하는 코드가 있다면 컴파일 실패 → 일일이 정리)

- [ ] **Step 6: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/job/model/JobType.kt \
        app/backend/src/main/kotlin/com/s210/backend/domain/job/application/JobService.kt \
        app/backend/src/test/kotlin/com/s210/backend/domain/job/presentation/JobControllerPollingTest.kt
git commit -m "refactor(job): remove dead JobType.TTS_PREVIEW and JobService preview branch"
```

---

## Task 6: FE — postVoicePreview 타입 + getVoicePreview 신규 (mypage)

**Files:**
- Modify: `app/frontend/src/features/mypage/voice-profile-manager/api/postVoicePreview.ts`
- Create: `app/frontend/src/features/mypage/voice-profile-manager/api/getVoicePreview.ts`

- [ ] **Step 1: postVoicePreview 응답 타입 변경**

`app/frontend/src/features/mypage/voice-profile-manager/api/postVoicePreview.ts` 전체 교체:

```typescript
import { post } from '../../../../shared/api'

const VOICE_PROFILES_ENDPOINT = '/voice-profiles'

export interface VoicePreviewJobDto {
  previewId: string
  jobType: string
  status: string
}

/** POST /api/voice-profiles/{id}/preview — TTS 미리듣기 비동기 작업 시작 (202 Accepted) */
export function postVoicePreview(
  voiceProfileId: number,
  text: string,
  language: string = 'ko-KR',
): Promise<VoicePreviewJobDto> {
  return post<VoicePreviewJobDto>(`${VOICE_PROFILES_ENDPOINT}/${voiceProfileId}/preview`, {
    text,
    language,
  })
}
```

- [ ] **Step 2: getVoicePreview 신규**

`app/frontend/src/features/mypage/voice-profile-manager/api/getVoicePreview.ts`:

```typescript
import { get } from '../../../../shared/api'

const VOICE_PROFILES_ENDPOINT = '/voice-profiles'

export interface VoicePreviewStatusDto {
  previewId: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  audioUrl: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  finishedAt: string | null
}

/** GET /api/voice-profiles/previews/{previewId} — 미리듣기 잡 상태 폴링 */
export function getVoicePreview(previewId: string): Promise<VoicePreviewStatusDto> {
  return get<VoicePreviewStatusDto>(`${VOICE_PROFILES_ENDPOINT}/previews/${previewId}`)
}
```

- [ ] **Step 3: 빌드(타입체크)**

```bash
cd app/frontend && pnpm build
```

Expected: 빌드 성공. (이 시점에 useVoiceClone.ts 가 아직 옛 타입을 쓰면 타입 에러 — Task 7 에서 해결)

> 만약 빌드 실패라면 Task 7 까지 묶어서 한 번에 검증. 임시로 Step 3 skip 해도 됨.

- [ ] **Step 4: 커밋**

```bash
git add app/frontend/src/features/mypage/voice-profile-manager/api/postVoicePreview.ts \
        app/frontend/src/features/mypage/voice-profile-manager/api/getVoicePreview.ts
git commit -m "feat(fe-mypage): postVoicePreview returns previewId, add getVoicePreview"
```

---

## Task 7: FE — useVoiceClone (mypage) polling swap

**Files:**
- Modify: `app/frontend/src/features/mypage/voice-profile-manager/lib/useVoiceClone.ts`

- [ ] **Step 1: import + polling 부분 swap**

`app/frontend/src/features/mypage/voice-profile-manager/lib/useVoiceClone.ts`:

상단 import 변경:

기존:
```typescript
import { getGenerationJob } from '../../../story-creation/storyboard-prompt/api/getGenerationJob'
```

변경:
```typescript
import { getVoicePreview } from '../api/getVoicePreview'
```

`previewTts` 콜백 안의 polling 부분 변경. 기존:

```typescript
      // BE에 TTS 미리듣기 비동기 작업 요청
      const { jobId } = await postVoicePreview(profileId, text)

      // 3초 간격 polling — 최대 5분
      const POLL_INTERVAL = 3_000
      const MAX_DURATION = 5 * 60 * 1000
      const start = Date.now()

      const pollResult = await new Promise<string>((resolve, reject) => {
        const poll = async () => {
          if (Date.now() - start > MAX_DURATION) {
            reject(new Error('TTS 생성 시간이 초과되었습니다.'))
            return
          }
          try {
            const job = await getGenerationJob(jobId)
            if (job.status === 'SUCCESS') {
              const payload = job.resultPayload as Record<string, unknown> | null
              const audioUrl = (payload?.audioUrl ?? payload?.url ?? '') as string
              if (!audioUrl) {
                reject(new Error('TTS 결과에 오디오 URL이 없습니다.'))
                return
              }
              resolve(audioUrl)
              return
            }
            if (job.status === 'FAILED') {
              reject(new Error(job.errorMessage ?? 'TTS 생성에 실패했습니다.'))
              return
            }
            setTimeout(poll, POLL_INTERVAL)
          } catch (err) {
            reject(err)
          }
        }
        setTimeout(poll, POLL_INTERVAL)
      })
```

변경:

```typescript
      // BE에 TTS 미리듣기 비동기 작업 요청
      const { previewId } = await postVoicePreview(profileId, text)

      // 3초 간격 polling — 최대 5분
      const POLL_INTERVAL = 3_000
      const MAX_DURATION = 5 * 60 * 1000
      const start = Date.now()

      const pollResult = await new Promise<string>((resolve, reject) => {
        const poll = async () => {
          if (Date.now() - start > MAX_DURATION) {
            reject(new Error('TTS 생성 시간이 초과되었습니다.'))
            return
          }
          try {
            const job = await getVoicePreview(previewId)
            if (job.status === 'SUCCESS') {
              if (!job.audioUrl) {
                reject(new Error('TTS 결과에 오디오 URL이 없습니다.'))
                return
              }
              resolve(job.audioUrl)
              return
            }
            if (job.status === 'FAILED') {
              reject(new Error(job.errorMessage ?? 'TTS 생성에 실패했습니다.'))
              return
            }
            setTimeout(poll, POLL_INTERVAL)
          } catch (err) {
            reject(err)
          }
        }
        setTimeout(poll, POLL_INTERVAL)
      })
```

- [ ] **Step 2: 빌드(타입체크)**

```bash
pnpm build
```

Expected: mypage 부분 타입 에러 0. story-creation 쪽이 아직 옛 타입 쓰면 거기서 타입 에러 — Task 8 에서 해결.

- [ ] **Step 3: 커밋**

```bash
git add app/frontend/src/features/mypage/voice-profile-manager/lib/useVoiceClone.ts
git commit -m "feat(fe-mypage): useVoiceClone polls /voice-profiles/previews endpoint"
```

---

## Task 8: FE — voiceProfileApi + useVoiceClone (story-creation) polling swap

**Files:**
- Modify: `app/frontend/src/features/story-creation/voice-clone/api/voiceProfileApi.ts`
- Modify: `app/frontend/src/features/story-creation/voice-clone/model/useVoiceClone.ts`

- [ ] **Step 1: voiceProfileApi 의 VoicePreviewJobDto 변경 + getVoicePreview 추가**

`app/frontend/src/features/story-creation/voice-clone/api/voiceProfileApi.ts`:

기존 `VoicePreviewJobDto` 인터페이스 교체:

```typescript
export interface VoicePreviewJobDto {
  previewId: string
  jobType: string
  status: string
}
```

기존 `postVoicePreview` 함수는 본문 변경 불필요 (그대로). 그 아래에 추가:

```typescript
export interface VoicePreviewStatusDto {
  previewId: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  audioUrl: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  finishedAt: string | null
}

/** GET /api/voice-profiles/previews/{previewId} — 미리듣기 잡 상태 폴링 */
export async function getVoicePreview(previewId: string): Promise<VoicePreviewStatusDto> {
  return get<VoicePreviewStatusDto>(`${VOICE_PROFILE_ENDPOINT}/previews/${previewId}`)
}
```

- [ ] **Step 2: useVoiceClone (story-creation) polling 변경**

`app/frontend/src/features/story-creation/voice-clone/model/useVoiceClone.ts`:

상단 import 변경:

기존:
```typescript
import { presignVoiceUpload, uploadAudioToS3, commitVoiceProfile, getVoiceProfiles, getRecordingScript, postVoicePreview } from '../api/voiceProfileApi'
import { getGenerationJob } from '../../storyboard-prompt/api/getGenerationJob'
```

변경:
```typescript
import { presignVoiceUpload, uploadAudioToS3, commitVoiceProfile, getVoiceProfiles, getRecordingScript, postVoicePreview, getVoicePreview } from '../api/voiceProfileApi'
```

`previewTts` 콜백 안의 polling 부분 변경. 기존:

```typescript
      // BE에 TTS 미리듣기 비동기 작업 요청
      const { jobId } = await postVoicePreview(profileId, text)

      // 3초 간격 polling — 최대 5분
      const POLL_INTERVAL = 3_000
      const MAX_DURATION = 5 * 60 * 1000
      const start = Date.now()

      const pollResult = await new Promise<string>((resolve, reject) => {
        const poll = async () => {
          if (Date.now() - start > MAX_DURATION) {
            reject(new Error('TTS 생성 시간이 초과되었습니다.'))
            return
          }
          try {
            const job = await getGenerationJob(jobId)
            if (job.status === 'SUCCESS') {
              const payload = job.resultPayload as Record<string, unknown> | null
              const audioUrl = (payload?.audioUrl ?? payload?.url ?? '') as string
              if (!audioUrl) {
                reject(new Error('TTS 결과에 오디오 URL이 없습니다.'))
                return
              }
              resolve(audioUrl)
              return
            }
            if (job.status === 'FAILED') {
              reject(new Error(job.errorMessage ?? 'TTS 생성에 실패했습니다.'))
              return
            }
            setTimeout(poll, POLL_INTERVAL)
          } catch (err) {
            reject(err)
          }
        }
        setTimeout(poll, POLL_INTERVAL)
      })
```

변경:

```typescript
      // BE에 TTS 미리듣기 비동기 작업 요청
      const { previewId } = await postVoicePreview(profileId, text)

      // 3초 간격 polling — 최대 5분
      const POLL_INTERVAL = 3_000
      const MAX_DURATION = 5 * 60 * 1000
      const start = Date.now()

      const pollResult = await new Promise<string>((resolve, reject) => {
        const poll = async () => {
          if (Date.now() - start > MAX_DURATION) {
            reject(new Error('TTS 생성 시간이 초과되었습니다.'))
            return
          }
          try {
            const job = await getVoicePreview(previewId)
            if (job.status === 'SUCCESS') {
              if (!job.audioUrl) {
                reject(new Error('TTS 결과에 오디오 URL이 없습니다.'))
                return
              }
              resolve(job.audioUrl)
              return
            }
            if (job.status === 'FAILED') {
              reject(new Error(job.errorMessage ?? 'TTS 생성에 실패했습니다.'))
              return
            }
            setTimeout(poll, POLL_INTERVAL)
          } catch (err) {
            reject(err)
          }
        }
        setTimeout(poll, POLL_INTERVAL)
      })
```

- [ ] **Step 3: 빌드 + 린트**

```bash
pnpm build && pnpm lint
```

Expected: 빌드 성공, 린트 에러 0.

- [ ] **Step 4: 커밋**

```bash
git add app/frontend/src/features/story-creation/voice-clone/api/voiceProfileApi.ts \
        app/frontend/src/features/story-creation/voice-clone/model/useVoiceClone.ts
git commit -m "feat(fe-story-creation): useVoiceClone polls /voice-profiles/previews endpoint"
```

---

## Task 9: 풀 빌드 + 전체 테스트

**Files:** —

- [ ] **Step 1: 백엔드 풀 테스트**

```bash
cd app/backend && ./gradlew test
```

Expected: 모든 테스트 PASS, 0 failure.

- [ ] **Step 2: 백엔드 빌드**

```bash
./gradlew bootJar
```

Expected: jar 산출물 생성 성공.

- [ ] **Step 3: 프론트엔드 빌드 + 린트**

```bash
cd ../frontend && pnpm build && pnpm lint
```

Expected: 둘 다 성공.

- [ ] **Step 4: 전체 변경 요약**

```bash
cd ../.. && git log --oneline origin/dev..HEAD
git diff origin/dev...HEAD --stat
```

Expected: 5개 정도의 커밋 (Task 1, 2, 3, 4, 5 백엔드 + Task 6, 7, 8 프론트), 변경 파일 약 12-14개.

---

## Task 10: 수동 검증 (dev 배포 후)

**Files:** —

> 이 태스크는 코드 작업이 아닌 검증 단계입니다. 머지 + dev 배포 후 수행.

- [ ] **Step 1: PR 생성 → 리뷰 → dev 머지**

```bash
git push -u origin feature/tts/preview-redis-correlation
gh pr create --base dev --title "[BE/FE] Refactor: TTS preview Redis correlation (DB row 제거)" --body "$(cat <<'EOF'
## Summary
- TTS preview 의 correlation/state 를 MySQL `story_generation_jobs` → Redis Hash 로 이전
- 현재 dev 의 500 (job_type ENUM truncation) 해소
- 신규 GET `/api/voice-profiles/previews/{previewId}` 엔드포인트
- `JobType.TTS_PREVIEW` enum 멤버 및 `JobService` preview 분기 dead code 제거
- AI 워커 / RabbitMQ / DB 마이그레이션 변경 없음

Spec: `docs/superpowers/specs/2026-04-30-tts-preview-redis-correlation-design.md`

## Test plan
- [x] 백엔드 단위 테스트 (TtsPreviewRedisRepository, VoicePreviewService, TtsResultHandler, JobService) PASS
- [x] FE 빌드 + 린트 PASS
- [ ] dev 배포 후 브라우저에서 미리듣기 1회 정상 동작 확인
- [ ] dev-redis 에서 `KEYS storybook:tts:preview:*` 로 키 생성 확인
- [ ] dev-backend 로그에서 truncation 에러 사라짐 확인
- [ ] 1시간 후 키 자동 만료 확인 (선택)
EOF
)"
```

- [ ] **Step 2: 머지 후 서버에서 dev-backend 재기동 확인**

```bash
ssh -i K14S210T.pem ubuntu@k14s210.p.ssafy.io
docker ps | grep dev-backend
docker logs --tail 50 dev-backend | grep -E "Started|Tomcat started"
```

Expected: 정상 기동 로그.

- [ ] **Step 3: 브라우저에서 preview 실행 (golden path)**

`https://k14s210.p.ssafy.io:3443/creation` 에서 voice profile 선택 → "미리듣기" 클릭. 오디오가 정상 재생되는지 확인.

- [ ] **Step 4: 서버 로그에 ENUM truncation 에러 없음 확인**

```bash
docker logs --since 10m dev-backend 2>&1 | grep -i "truncat" | head
```

Expected: 출력 없음.

- [ ] **Step 5: Redis 키 생성 확인**

```bash
docker exec -it dev-redis redis-cli
> KEYS storybook:tts:preview:*
> HGETALL storybook:tts:preview:<생성된 ID 중 하나>
> TTL storybook:tts:preview:<같은 ID>
> exit
```

Expected: 1개 이상의 키, status=SUCCESS, audioUrl 채워짐, TTL ≤ 3600.

- [ ] **Step 6: 다른 user 의 previewId 시도 (403 검증, 선택)**

브라우저 DevTools 에서 다른 user 로 로그인 후 직접 fetch:

```javascript
fetch('/api/voice-profiles/previews/<남의-previewId>', { method: 'GET' })
  .then(r => console.log(r.status))
```

Expected: 403.

---

## Self-Review (작성자용 체크리스트)

이 plan 작성 직후 fresh eyes 로 spec 과 대조한 결과:

- ✅ Spec 의 모든 Backend 신규/수정/삭제 항목이 Task 1–5 에 매핑됨
- ✅ Spec 의 모든 Frontend 신규/수정 항목이 Task 6–8 에 매핑됨
- ✅ 신규 테스트(TtsPreviewRedisRepositoryTest, VoiceControllerPreviewStatusTest, TtsResultHandlerTest preview 케이스, VoicePreviewServiceTest 재작성) 모두 task 안에 포함
- ✅ 삭제 테스트(JobControllerPollingTest preview 케이스) Task 5 에 포함
- ✅ Rollout (배포/검증) Task 9, 10 에 포함
- ✅ 모든 step 에 실제 코드/명령 포함, "TBD" / "implement later" 패턴 없음
- ✅ 메서드/필드명 일관성: `createPending(previewId, userId, voiceProfileId)`, `markSuccess(previewId, audioUrl)`, `markFailed(previewId, errorCode, errorMessage)`, `get(previewId): TtsPreviewSnapshot?` — 모든 task 에서 동일
- ✅ `previewId` 는 String, `JobStatus` enum 에서 `RUNNING` 미사용 — spec 과 일치
- ✅ 마이그레이션 파일(V11) 만들지 않음 — spec 과 일치
- ✅ AI 워커 / RabbitMQ 변경 없음 — spec 과 일치
