# TTS Preview — Redis Correlation 도입 설계

**작성일**: 2026-04-30
**대상 브랜치**: `feature/tts/preview-redis-correlation` (dev base)
**작성자**: 강지석
**상태**: Draft (구현 착수 전)

## 배경 (Problem)

`feature/ai/tts` 머지(`98b40d9`) 이후 dev 환경에서 `POST /api/voice-profiles/{id}/preview` 요청이 500으로 실패하고 있음.

**근인**: `JobType` Kotlin enum 에는 `TTS_PREVIEW` 가 추가됐으나 MySQL `story_generation_jobs.job_type` ENUM 컬럼(V9 기준)에는 해당 값이 없음 → INSERT 시 MySQL 이 "Data truncated for column 'job_type'" (SQLState 01000, ErrorCode 1265) 반환 → 트랜잭션 롤백 → RabbitMQ publish 도 안 됨 → AI 워커는 메시지 수신 자체가 없음.

**선택지 평가**:
- A안 — V11 마이그레이션으로 ENUM 값 추가: 5분 수정, 코드 변경 없음. 단점: preview 잡 row 가 영속 테이블에 영구히 쌓임.
- B안 — preview correlation 을 Redis 로 이전: 더 큰 변경. 단점: 약 10–12 파일 수정, 회귀 위험. 장점: preview 의 휘발적 본질을 코드 구조에 반영, DB 정리(cleanup) 부담 제거.

본 설계는 **B안**을 선택한다. 근거: TTS 는 사용자별 모델을 학습/저장하는 구조가 아니라 매 요청 시 reference audio 로 추론하는 구조이므로, preview 는 본질적으로 휘발성이며 영속 저장의 가치가 거의 없다. story_generation_jobs 의 다른 사용처(스토리/이미지/본문 TTS 등)는 영속화가 의미 있지만 preview 는 그렇지 않다.

## 목표

- `POST /api/voice-profiles/{id}/preview` 가 정상 동작 (500 에러 해소)
- preview 의 correlation/state 를 Redis 로 이전, MySQL `story_generation_jobs` 미사용
- 다른 잡 타입(STORYBOARD, STORYBOARD_IMAGE, TTS, STORYBOARD_STORY_SUMMARY 등)의 동작/스키마는 변경 없음
- AI 워커(Python) 와 RabbitMQ 토폴로지 변경 없음
- FE polling UX 동등 수준 유지 (3초 간격, 5분 타임아웃)

## 비목표

- mypage / story-creation 양쪽에 중복된 `useVoiceClone.ts` 통합 (별도 이슈로 분리)
- 다른 잡 타입의 Redis 이전
- preview 결과의 영속 캐시 (사용자가 다시 누르면 재추론됨 — 기존 동작 유지)
- preview 의 cancel 기능

## 데이터 모델

### Redis Key

| 항목 | 값 |
|---|---|
| Key | `storybook:tts:preview:{previewId}` |
| previewId 형식 | UUID v4 |
| Type | Hash |
| TTL | 1시간 (`Duration.ofHours(1)`) — 기존 `JobStatusRedisRepository` 와 동일 |

### Hash Fields

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `userId` | string(Long) | ✅ | 인가 검증용. POST 시 인증 user 의 id |
| `voiceProfileId` | string(Long) | ✅ | 디버깅/로깅용 |
| `status` | string | ✅ | `PENDING` / `SUCCESS` / `FAILED` (기존 `JobStatus` enum 값을 그대로 사용. preview 는 중간 상태가 없으므로 `RUNNING` 은 사용하지 않음 — POST 시 PENDING 단일 셋팅, listener 가 SUCCESS 또는 FAILED 로 전이) |
| `audioUrl` | string | status=SUCCESS 시 | `PreviewTtsResultEnvelope.payload.audioUrl` 그대로 |
| `errorCode` | string | status=FAILED 시 | `PreviewTtsResultEnvelope.error.code` |
| `errorMessage` | string | status=FAILED 시 | `PreviewTtsResultEnvelope.error.message` (Redis 값 길이 한도 내) |
| `createdAt` | string(ISO8601) | ✅ | POST 처리 시각 |
| `finishedAt` | string(ISO8601) | terminal status 시 | listener 가 결과 수신한 시각 |

## API

### POST `/api/voice-profiles/{voiceProfileId}/preview`

**변경**: 응답 필드명만 변경 (`jobId` → `previewId`), 메서드/URL/요청 body 동일.

요청 body (변경 없음):
```json
{ "text": "...", "language": "en-US", "emotion": "NEUTRAL" }
```

응답 (202 Accepted):
```json
{ "data": { "previewId": "f47ac10b-58cc-4372-a567-0e02b2c3d479" } }
```

권한:
- 인증 user 가 voiceProfileId 의 소유자가 아닐 시 403
- voiceProfile 이 soft-deleted 면 404

### GET `/api/voice-profiles/previews/{previewId}` (신규)

응답 (200):
```json
{
  "data": {
    "previewId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "status": "PENDING" | "SUCCESS" | "FAILED",
    "audioUrl": "https://.../preview-audio.wav",
    "errorCode": null,
    "errorMessage": null,
    "createdAt": "2026-04-30T12:30:00Z",
    "finishedAt": "2026-04-30T12:30:08Z"
  }
}
```

권한:
- Redis hash 의 `userId` 와 인증 user 의 id 비교 → 불일치 시 403
- key 존재하지 않거나 TTL 만료 시 404 (FE 가 "미리듣기 만료" 안내)

## Backend 변경 사항

### 신규

- `app/backend/src/main/kotlin/com/s210/backend/common/redis/TtsPreviewRedisRepository.kt`
  - `createPending(previewId, userId, voiceProfileId)`
  - `markSuccess(previewId, audioUrl, finishedAt)`
  - `markFailed(previewId, errorCode, errorMessage, finishedAt)`
  - `get(previewId): TtsPreviewSnapshot?`
  - 패턴: 기존 `JobStatusRedisRepository` 와 동일 (`StringRedisTemplate`, `opsForHash`, `expire`)
- `TtsPreviewSnapshot` data class (같은 파일 또는 sibling)
- `domain/tts/presentation/response/TtsPreviewStatusResponse.kt` — GET 응답 DTO
- `VoiceController.voicePreviewStatus` 핸들러 — `GET /api/voice-profiles/previews/{previewId}`

### 수정

- `domain/tts/application/VoicePreviewService.kt`
  - `jobRepository: StoryGenerationJobRepository` 의존 제거 (그리고 `objectMapper` 도 더 이상 불필요)
  - `previewRedis: TtsPreviewRedisRepository` 의존 추가
  - 반환 타입 `Long` → `String` (UUID)
  - 본문: `UUID.randomUUID().toString()` → `previewRedis.createPending(...)` → `ttsService.publishPreview(...)`
  - `TtsPreviewJobMessage.jobId` 에 previewId 그대로 사용 (이미 String 타입이라 시그니처 변경 없음)
  - 기존 코드의 `storyId = 0` 더미 값 트릭 제거 — 더 이상 story 와 연관 없음
- `domain/tts/application/TtsResultHandler.handle(PreviewTtsResultEnvelope)`
  - `jobRepository.findById/save` 호출 제거
  - `previewRedis.markSuccess(envelope.jobId, payload.audioUrl)` 또는 `markFailed(...)`
  - 결과의 jobId 가 UUID 형식이 아닐 시 (잘못된 메시지) WARN 로그 후 skip
- `domain/voice/presentation/VoiceController.voiceProfilePreview`
  - 반환 타입의 `jobId` → `previewId`
- `domain/voice/presentation/response/VoicePreviewJobResponse.kt`
  - `jobId: Long` → `previewId: String`

### 삭제

- `domain/job/model/JobType.kt` — `TTS_PREVIEW` enum 멤버 삭제
- `domain/job/application/JobService.kt`
  - `assertOwned()` 의 `if (job.jobType == JobType.TTS_PREVIEW) { assertPreviewOwned ... }` 분기 삭제
  - `assertPreviewOwned()` private 메서드 삭제
  - 미사용이 된 `voiceProfileRepository`, `objectMapper` 등 주입 정리
- `JobControllerPollingTest.kt` — TTS_PREVIEW 관련 케이스 삭제

### 변경하지 않음

- `StoryGenerationJob` 엔티티 / DB 스키마
- 다른 잡 타입의 listener / handler 흐름
- RabbitMQ 라우팅키 / 큐 / 메시지 DTO
- AI 워커 (Python)
- DB 마이그레이션 (V11 안 만듦)

## Frontend 변경 사항

### 수정

- `app/frontend/src/features/mypage/voice-profile-manager/api/postVoicePreview.ts`
  - 응답 타입 `{ jobId: number }` → `{ previewId: string }`
- `app/frontend/src/features/mypage/voice-profile-manager/lib/useVoiceClone.ts`
  - import: `getGenerationJob` → `getVoicePreview`
  - polling 호출 부분 swap (status 분기는 동일 — `'SUCCESS'`, `'FAILED'`)
- `app/frontend/src/features/story-creation/voice-clone/api/voiceProfileApi.ts`
  - postVoicePreview 응답 타입 갱신
  - getVoicePreview 함수 추가 (또는 mypage 측 import 재사용)
- `app/frontend/src/features/story-creation/voice-clone/model/useVoiceClone.ts`
  - mypage 측과 동일한 변경

### 신규

- `app/frontend/src/features/mypage/voice-profile-manager/api/getVoicePreview.ts`
  - `GET /api/voice-profiles/previews/{previewId}` 호출
  - 응답 타입: `{ previewId, status, audioUrl?, errorCode?, errorMessage?, createdAt, finishedAt? }`

### 에러 분기

- 404 → "미리듣기가 만료되었어요. 다시 시도해주세요" (사용자 안내)
- 403 → 일반 에러 메시지 (사실상 자기 previewId 만 받으므로 발생 불가)
- 500 → 기존 `isApiError` 분기 재사용

## 실패 시나리오

| 상황 | 동작 |
|---|---|
| Redis 다운 (POST 시) | `createPending` 예외 → 500 반환, MQ publish 안 됨. 트랜잭션 의미적 일관성 보장. |
| Redis 다운 (GET 시) | 500 반환, FE 가 다음 polling 주기에 재시도. |
| Redis 다운 (Listener 결과 수신 시) | `markSuccess` 예외 → 결과 손실. FE 는 5분 polling 타임아웃 후 에러 표시 (현재와 동일 UX). |
| TTL 1시간 만료 후 polling | `get` 이 null → 404. FE 안내 후 재시도 유도. |
| 잘못된/위조 previewId | `get` null → 404 (UUID 라 추측 공격 사실상 불가). |
| 다른 user 의 previewId | snapshot.userId 불일치 → 403. |
| AI 워커가 잘못된 jobId echo | UUID 파싱 실패 또는 Redis key 부재 → WARN 로그 후 skip. |

## 테스트

### 신규

- `TtsPreviewRedisRepositoryTest.kt`
  - createPending → get 라운드트립
  - markSuccess → status/audioUrl/finishedAt 검증
  - markFailed → status/errorCode/errorMessage 검증
  - 부재 키 → null 반환
  - TTL 적용 검증 (테스트 환경에서는 짧은 TTL 로)
- `VoicePreviewServiceTest.kt` (재작성)
  - jobRepository mock 제거
  - previewRedis mock 으로 createPending 호출 검증
  - UUID 발급 검증 (반환값이 UUID 형식)
  - publishPreview 의 jobId 가 createPending 의 previewId 와 동일
- `VoiceControllerTest.kt` — preview status GET
  - 200 (본인의 previewId)
  - 403 (다른 user 의 previewId)
  - 404 (존재하지 않는 / 만료된 previewId)
- `TtsResultHandlerTest.kt` (preview 부분)
  - markSuccess 호출 검증
  - markFailed 호출 검증
  - jobRepository 미사용 검증

### 삭제

- `JobControllerPollingTest.kt` 의 TTS_PREVIEW 케이스

## Rollout

1. 새 브랜치 `feature/tts/preview-redis-correlation` (dev base) 에서 작업
2. 로컬 테스트 통과 확인
3. PR → dev 머지 → CI 빌드
4. 서버에서 `dev-backend` 컨테이너 재기동 (Flyway 변경 없음)
5. 검증:
   - 브라우저에서 preview 1회 실행 → 정상 재생 확인
   - 서버 로그에 truncation 에러 없음 확인
   - `docker exec dev-redis redis-cli KEYS 'storybook:tts:preview:*'` 로 키 생성 확인
   - 1시간 후 자동 만료 확인 (선택)

### 환경변수
추가/변경 없음. 기존 Redis 연결 (`SPRING_DATA_REDIS_*`) 그대로 사용.

### 인프라
추가 컨테이너 / 볼륨 / 포트 변경 없음.

### 롤백
배포 직후 문제 시 이전 이미지로 컨테이너 재기동. Redis key 는 1시간 후 자동 소멸. DB 변경 없으므로 데이터 롤백 불필요.

## Out of Scope (별도 이슈)

- mypage / story-creation 의 `useVoiceClone.ts` 중복 통합
- preview 결과의 영속 캐시 (사용자가 같은 텍스트로 재요청 시 추론 재실행)
- preview 의 cancel 기능
- 다른 잡 타입의 Redis 이전
