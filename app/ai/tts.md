# TTS Notes

## 1. Current Behavior

현재 AI TTS는 `CosyVoice inference_cross_lingual` 기준으로 동작한다.

- reference voice: `app/ai/.runtime/storage/voices/{voiceId}/reference.wav`
- preview: `POST /api/v1/voices/{voiceId}/preview`
- story: `POST /api/v1/tts/story`
- storage:
  - 로컬 파일 생성
  - S3 업로드
  - 응답에는 `audioUrl`, `s3Key` 포함

감정 제어는 현재 정교하게 쓰지 않는다. 실제 엔진 호출은 안정화된 prefix를 붙인 plain cloning 중심이다.

```text
You are a helpful assistant. Read slowly.<|endofprompt|>
```

## 2. Key Files

- `app/ai/app/api/routes/tts.py`
  - preview/story HTTP 진입점
- `app/ai/app/services/dev_tts_service.py`
  - voice reference 조회
  - preview 생성
  - story sentence TTS 생성
  - manifest 기록
- `app/ai/app/services/cosyvoice_client.py`
  - CosyVoice HTTP 호출
- `app/ai/app/services/storage_service.py`
  - local/S3 저장 추상화
- `app/ai/app/schemas/tts.py`
  - preview/story request schema

## 3. Runtime Paths

```text
app/ai/.runtime/storage/voices/{voiceId}/reference.wav
app/ai/.runtime/storage/voices/{voiceId}/metadata.json
app/ai/.runtime/storage/generated/voice-preview/{voiceId}/...
app/ai/.runtime/storage/generated/story-tts/{storyId}/sentences/...
app/ai/.runtime/storage/generated/story-tts/{storyId}/full-book/full-book.wav
app/ai/.runtime/manifests/jobs/{jobId}.json
```

설명:

- `voices/...`
  - reference voice cache
- `generated/voice-preview/...`
  - preview 산출물
- `generated/story-tts/...`
  - sentence별 TTS 및 full-book 산출물
- `manifests/jobs/...`
  - 로컬 개발용 job 상태 기록

## 4. Preview Flow

1. `voiceId`로 `reference.wav` 확인
2. prefix + text 조합
3. CosyVoice `inference_cross_lingual` 호출
4. 결과 오디오를 local + S3 저장
5. `previewId`, `audioUrl`, `s3Key`, `durationMs` 반환

요청 예시:

```json
{
  "text": "Mina looked at the sea and smiled quietly.",
  "language": "en-US",
  "format": "wav",
  "options": {
    "emotion": "NEUTRAL",
    "stylePrompt": null,
    "speakingRate": null,
    "pitch": null,
    "volumeGain": null,
    "useSsml": false
  }
}
```

## 5. Story Flow

1. story request 수신
2. sentence별로 CosyVoice 호출
3. sentence wav를 local + S3 저장
4. 필요하면 full-book wav 생성 후 local + S3 저장
5. manifest에 결과 기록

결과 구조 핵심:

- `items[]`
  - sentence별 오디오 결과
- `sceneSentenceUpdates[]`
  - backend가 sentence audio URL 갱신할 때 쓰기 쉬운 구조
- `fullBookAudio`
  - 전체 오디오북 결과

## 6. Storage

현재 TTS 결과는 local과 S3를 함께 쓴다.

- preview
  - local 저장
  - S3 업로드
  - 응답은 S3 URL 반환
- story
  - sentence별 local 저장
  - sentence별 S3 업로드
  - full-book local 저장
  - full-book S3 업로드

기본 S3 prefix:

```text
stories/tts
```

예시 key:

```text
stories/tts/generated/voice-preview/test-mom/preview_xxx.wav
stories/tts/generated/story-tts/1201/sentences/5001.wav
stories/tts/generated/story-tts/1201/full-book/full-book.wav
```

## 7. Environment Variables

핵심 TTS env:

```env
COSYVOICE_BASE_URL=http://localhost:8001
COSYVOICE_CROSS_LINGUAL_PATH=/inference_cross_lingual
COSYVOICE_TIMEOUT_SEC=60

TTS_STORAGE_MODE=local
TTS_PUBLIC_BASE_URL=/static
TTS_STORAGE_ROOT=app/ai/.runtime/storage
TTS_MANIFEST_ROOT=app/ai/.runtime/manifests

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=
AWS_S3_PREFIX=stories/tts
AWS_S3_PUBLIC_BASE_URL=
```

## 8. MQ Integration

### 목적

story TTS를 HTTP background task 대신 MQ worker로 돌릴 수 있게 AI 쪽 준비를 해둔다.

backend는 아직 건드리지 않는다. 즉 AI는 아래 메시지를 받을 준비만 한다.

- request routing key: `ai.gpu.tts.generate`
- result completed routing key: `ai.result.tts.generate.completed`
- result failed routing key: `ai.result.tts.generate.failed`

그리고 storyboard 결과 queue와는 분리해서 TTS 전용 result queue를 쓴다.

### AI-side MQ files

- `app/ai/app/schemas/mq_tts.py`
  - TTS request/result envelope
- `app/ai/app/consumers/tts_consumer.py`
  - TTS request consume
  - TTS success/failure publish
- `app/ai/app/mq/publisher.py`
  - `TtsResultPublisher`
- `app/ai/app/mq/client.py`
  - TTS request queue bind
  - TTS result queue bind
- `app/ai/worker_tts.py`
  - TTS 전용 worker entrypoint

### AI-side TTS MQ flow

1. `ai.gpu.tts.generate` 메시지 consume
2. manifest에 `PENDING -> RUNNING` 기록
3. 기존 TTS 본체 로직 실행
4. 성공 시 `ai.result.tts.generate.completed` publish
5. 실패 시 `ai.result.tts.generate.failed` publish
6. manifest에 `SUCCESS` 또는 `FAILED` 기록

### Request Message Shape

```json
{
  "jobId": "story_tts_1234abcd",
  "jobType": "TTS",
  "storyId": 1201,
  "payload": {
    "storyId": 1201,
    "voiceId": "test-mom",
    "language": "en-US",
    "format": "wav",
    "options": {
      "defaultEmotion": "NEUTRAL",
      "defaultStylePrompt": null,
      "generateFullBookAudio": true,
      "speakingRate": null,
      "pitch": null,
      "volumeGain": null,
      "useSsml": false
    },
    "sentences": [
      {
        "sentenceId": 5001,
        "pageNumber": 1,
        "sentenceOrder": 1,
        "text": "Mina looked at the sea and smiled quietly.",
        "speakerKey": "narrator",
        "emotion": "NEUTRAL",
        "stylePrompt": null,
        "ssml": null
      }
    ]
  }
}
```

### Result Message Shape

성공:

```json
{
  "jobId": "story_tts_1234abcd",
  "type": "GENERATE_TTS_COMPLETED",
  "storyId": 1201,
  "status": "COMPLETED",
  "payload": {
    "storyId": 1201,
    "voiceId": "test-mom",
    "items": [],
    "sceneSentenceUpdates": [],
    "summary": {
      "sentenceCount": 0
    },
    "fullBookAudio": null
  }
}
```

실패:

```json
{
  "jobId": "story_tts_1234abcd",
  "type": "GENERATE_TTS_FAILED",
  "storyId": 1201,
  "status": "FAILED",
  "error": {
    "code": "GENERATE_TTS_ENGINE_ERROR",
    "message": "..."
  }
}
```

### MQ Env Keys

```env
RABBITMQ_TTS_GENERATE_QUEUE=ai.gpu.request.queue
RABBITMQ_TTS_RESULT_QUEUE=ai.result.tts.queue
RABBITMQ_TTS_GENERATE_ROUTING_KEY=ai.gpu.tts.generate
RABBITMQ_TTS_RESULT_BINDING_KEY=ai.result.tts.#
RABBITMQ_TTS_GENERATE_COMPLETED_ROUTING_KEY=ai.result.tts.generate.completed
RABBITMQ_TTS_GENERATE_FAILED_ROUTING_KEY=ai.result.tts.generate.failed
```

## 9. Run Commands

기존 storyboard/image worker:

```bash
python app/ai/worker.py
```

TTS 전용 worker:

```bash
python app/ai/worker_tts.py
```

로컬 API:

```bash
cd app/ai
python -m uvicorn app.main:app --reload --port 8000
```

## 10. Current Boundaries

현재 문서 기준으로 AI가 맡는 범위:

- reference voice 기반 preview/story 생성
- local/S3 저장
- TTS MQ consume/publish
- local manifest 기록

현재 아직 backend에서 정해야 할 범위:

- voice profile과 AI `voiceId` 매핑 정책
- MQ request 발행
- MQ result consume 후 DB 저장
- full-book audio를 backend DB 어디에 저장할지
