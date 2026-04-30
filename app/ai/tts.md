# TTS Notes

## 1. Current Architecture

현재 TTS는 CosyVoice `inference_cross_lingual` 기준으로 동작한다.

- preview endpoint: `POST /api/voices/{voiceId}/preview`
- story TTS endpoint: `POST /api/tts/story`
- MQ request routing key: `ai.gpu.tts.generate`
- MQ result routing keys:
  - `ai.result.tts.generate.completed`
  - `ai.result.tts.generate.failed`

생성 방식은 문장별 순차 호출이다.

- sentence 1개당 CosyVoice 1회 호출
- `generateFullBookAudio=true`면 sentence wav 생성 후 full-book wav를 추가로 합친다

## 2. Reference Audio Resolution

이제 AI는 로컬 `voices/{voiceId}/reference.wav`만 보지 않는다.

우선순위:

1. 로컬 캐시 파일 존재 시 재사용
   - `app/ai/.runtime/storage/voices/{voiceId}/reference.wav`
2. `referenceAudioS3Key`가 있으면 S3에서 다운로드
3. `referenceAudioUrl`이 있으면 다운로드
4. `referenceAudioUrl` 값이 실제 URL이 아니라 `stories/...` 형태의 raw S3 key면 S3 key로 간주

즉 현재는 아래 두 방식 모두 허용한다.

```json
{
  "referenceAudioS3Key": "stories/voice/42/reference.wav"
}
```

```json
{
  "referenceAudioUrl": "https://bucket.s3.ap-northeast-2.amazonaws.com/stories/voice/42/reference.wav"
}
```

또는 backward compatibility:

```json
{
  "referenceAudioUrl": "stories/voice/42/reference.wav"
}
```

주의:

- 현재 AI는 **다운로드된 파일이 wav라고 가정**한다.
- 즉 장기적으로는 DB에서 원본 업로드와 TTS용 reference를 분리하는 것이 맞다.
- 권장 구조:
  - `audio_url`: 원본 녹음
  - `reference_audio_s3_key`: TTS용 trim/정제 reference
  - `tts_voice_url`: 마지막 preview/sample 음성

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
  - reference voice local cache
- `generated/voice-preview/...`
  - preview 결과
- `generated/story-tts/...`
  - sentence별 TTS 및 full-book 산출물
- `manifests/jobs/...`
  - 로컬 job 상태 기록

## 4. Backend Integration Status

백엔드 기준으로 현재 구현된 것은 아래와 같다.

### Voice / Preview

- voice profile CRUD 구현됨
- preview endpoint 구현됨
- backend는 voice profile의 저장 값을 보고
  - `stories/...`면 `referenceAudioS3Key`
  - 그 외면 `referenceAudioUrl`
  로 AI preview API를 호출한다

현재 backend preview 호출 경로:

```text
POST /api/voices/{voiceId}/preview
```

### Story TTS

- confirm 시 `StoryGenerationJob(jobType=TTS)` 생성
- 문장 캐시 lookup 수행
- cache miss sentence만 MQ로 publish
- AI 결과 consume 후
  - `scene_sentences.tts_audio_url` 반영
  - `story_generation_jobs` 상태 업데이트
  - Redis TTS cache 저장

즉 backend는 이미 AI worker 결과를 소비할 수 있는 상태다.

## 5. MQ Request Message Shape

공통 envelope:

```json
{
  "jobId": "story_tts_1234abcd",
  "jobType": "TTS",
  "storyId": 1201,
  "payload": {
    "storyId": 1201,
    "voiceId": "42",
    "referenceAudioUrl": null,
    "referenceAudioS3Key": "stories/voice/42/reference.wav",
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

허용 emotion:

- `NEUTRAL`
- `WARM`
- `HAPPY`
- `EXCITED`
- `CALM`
- `SAD`
- `SOFT`
- `SERIOUS`
- `ANGRY`
- `NARRATION`

주의:

- `emotion`, `stylePrompt`, `speakingRate`, `pitch`, `volumeGain`은 현재 실제 CosyVoice 생성 파라미터로는 반영되지 않는다
- metadata 성격으로만 남는다

## 6. MQ Result Message Shape

성공:

```json
{
  "jobId": "story_tts_1234abcd",
  "type": "GENERATE_TTS_COMPLETED",
  "storyId": 1201,
  "status": "COMPLETED",
  "payload": {
    "storyId": 1201,
    "voiceId": "42",
    "items": [
      {
        "sentenceId": 5001,
        "appliedStyle": {
          "emotion": "NEUTRAL",
          "stylePrompt": null
        },
        "audio": {
          "audioUrl": "https://...",
          "s3Key": "stories/tts/generated/story-tts/1201/sentences/5001.wav",
          "durationMs": 2100,
          "format": "wav"
        }
      }
    ],
    "sceneSentenceUpdates": [
      {
        "sentenceId": 5001,
        "ttsAudioUrl": "https://...",
        "ttsAudioS3Key": "stories/tts/generated/story-tts/1201/sentences/5001.wav"
      }
    ],
    "summary": {
      "sentenceCount": 1
    },
    "fullBookAudio": {
      "audioUrl": "https://...",
      "s3Key": "stories/tts/generated/story-tts/1201/full-book/full-book.wav",
      "format": "wav"
    }
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

## 7. Files Changed for S3 Reference Support

이번 변경으로 수정된 핵심 파일:

- `app/ai/app/schemas/tts.py`
  - `PreviewRequest.referenceAudioUrl`
  - `PreviewRequest.referenceAudioS3Key`
  - `StoryTtsRequest.referenceAudioS3Key`
- `app/ai/app/services/storage_service.py`
  - `download_s3_bytes()` 추가
- `app/ai/app/services/dev_tts_service.py`
  - `resolve_reference_voice()` 추가
  - preview/story TTS에서 공통 resolver 사용
- `app/ai/app/api/routes/tts.py`
  - preview API가 `referenceAudioUrl`, `referenceAudioS3Key`를 전달
- `app/ai/app/consumers/tts_consumer.py`
  - worker 사전 다운로드 로직 제거
  - service 공통 resolver에 위임

backend 쪽 같이 맞춘 파일:

- `app/backend/.../VoicePreviewRequest.kt`
  - `referenceAudioS3Key` 추가
- `app/backend/.../StoryTtsPayload.kt`
  - `referenceAudioS3Key` 추가
- `app/backend/.../VoicePreviewService.kt`
  - 저장 값이 S3 key면 `referenceAudioS3Key`로 전송
  - preview URI를 `/api/voices/{voiceId}/preview`로 수정
- `app/backend/.../StoryConfirmService.kt`
  - TTS MQ payload 생성 시 S3 key / URL 분기

## 8. Local Test Guide

### 8-1. Infra

RabbitMQ / Redis / MySQL:

```powershell
cd infra\compose
docker compose -f docker-compose.infra-local.yml up -d
```

확인:

```powershell
docker ps
```

RabbitMQ 관리 페이지:

```text
http://localhost:15673
```

### 8-2. CosyVoice

CosyVoice 서버는 별도 포트에서 먼저 띄운다.

예:

```bash
cd ~/work/CosyVoice/runtime/python/fastapi
python server.py --port 8001 --model_dir ~/work/CosyVoice/pretrained_models/Fun-CosyVoice3-0.5B
```

AI `.env`:

```env
COSYVOICE_BASE_URL=http://localhost:8001
COSYVOICE_CROSS_LINGUAL_PATH=/inference_cross_lingual
COSYVOICE_TIMEOUT_SEC=180
```

### 8-3. AI API / Worker

같은 가상환경에서 실행하는 것이 중요하다.

```powershell
cd app\ai
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

worker:

```powershell
cd app\ai
python .\worker_tts.py
```

### 8-4. Preview API Test

body 예시:

```json
{
  "text": "Hello, Lina.",
  "language": "en-US",
  "format": "wav",
  "referenceAudioS3Key": "stories/voice/42/reference.wav",
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

호출:

```bash
curl -X POST http://localhost:8000/api/voices/42/preview ^
  -H "Content-Type: application/json" ^
  -d @preview.json
```

예상:

- `app/ai/.runtime/storage/voices/42/reference.wav` 생성
- preview audio 생성
- `audioUrl`, `s3Key`, `durationMs` 반환

### 8-5. Story MQ Test

1. 요청 큐 purge
   - `ai.gpu.request.queue`
2. 필요하면 결과 큐 purge
   - `ai.result.tts.queue`
3. 아래 메시지 publish

```json
{
  "jobId": "story_tts_test_s3_001",
  "jobType": "TTS",
  "storyId": 1,
  "payload": {
    "storyId": 1,
    "voiceId": "42",
    "referenceAudioS3Key": "stories/voice/42/reference.wav",
    "language": "en-US",
    "format": "wav",
    "options": {
      "defaultEmotion": "NEUTRAL",
      "defaultStylePrompt": null,
      "generateFullBookAudio": false,
      "speakingRate": null,
      "pitch": null,
      "volumeGain": null,
      "useSsml": false
    },
    "sentences": [
      {
        "sentenceId": 1001,
        "pageNumber": 1,
        "sentenceOrder": 1,
        "text": "Lina looked at the sea and smiled quietly.",
        "speakerKey": "narrator",
        "emotion": "NEUTRAL",
        "stylePrompt": null,
        "ssml": null
      }
    ]
  }
}
```

exchange / routing:

```text
exchange: ai.request
routing key: ai.gpu.tts.generate
```

예상:

- local cache:
  - `app/ai/.runtime/storage/voices/42/reference.wav`
- sentence output:
  - `app/ai/.runtime/storage/generated/story-tts/1/sentences/1001.wav`
- result event:
  - `ai.result.tts.generate.completed`

### 8-6. Troubleshooting

`voice not found`

- 로컬 cache 없음
- `referenceAudioS3Key` / `referenceAudioUrl` 둘 다 없음

`StorageDownloadError`

- S3 key 오타
- AWS credential / bucket / region 설정 문제

`CosyVoiceInvocationError`

- CosyVoice 서버 미기동
- `COSYVOICE_BASE_URL` / path mismatch

`Ready > 0` on `ai.result.tts.queue`

- AI가 결과를 publish 했지만 backend consumer가 안 먹고 있는 상태

## 9. Remaining Boundaries

현재 아직 남아 있는 구조적 과제:

- `voice_profiles.audio_url`와 TTS용 reference 분리
- `reference_audio_s3_key` 컬럼 정식 도입
- 원본이 wav가 아닐 때의 변환/정제 파이프라인
- 긴 story TTS의 job 분할 또는 병렬화
- worker reconnect / publish reconnect 강화
