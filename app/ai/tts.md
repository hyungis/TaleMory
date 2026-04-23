# TTS API 설계 문서

## 1. 문서 목적

이 문서는 FastAPI 기반 AI 서버에서 사용할 TTS, 보이스 등록, 감정 제어 읽기 기능을 정리한 문서입니다.

이 문서의 핵심 전제는 아래와 같습니다.

- 이 프로젝트는 전통적인 파인튜닝 방식의 보이스 클로닝을 하지 않습니다.
- CosyVoice 기반 `Zero-shot Voice Cloning` 방식 기준으로 설계합니다.
- 이 문서에서 `CosyVoice 모델`, `CosyVoice 서버`라고 부르는 대상은 모두 동일한 TTS 추론 계층을 의미합니다.
- 실제 무거운 음성 생성 작업은 RabbitMQ 기반 비동기 job으로 처리하고, HTTP API는 job 생성/조회 facade 역할로 설계합니다.
- 사용자별로 학습된 별도 모델을 저장하지 않습니다.
- 저장하는 것은 `레퍼런스 음성 파일`과 `메타데이터`, 그리고 필요하면 `프롬프트 캐시`입니다.
- 실제 TTS 생성 시에는 공통 사전학습 모델에 사용자 레퍼런스 음성을 매번 함께 넣어 생성합니다.

### 1.1 이번 문서에서 내가 맡는 범위

이번 문서는 전체 AI 기능이 아니라, `부모 목소리로 동화 본문을 읽어주는 TTS` 구현 범위에 집중합니다.

내가 직접 구현할 핵심 범위:

- 부모 음성을 `reference.wav`로 정리해 TTS에 재사용 가능한 보이스 자산으로 만드는 부분
- 등록된 보이스로 짧은 미리듣기 TTS를 만드는 부분
- 동화 문장 목록을 받아 문장별 TTS를 생성하는 부분
- 문장별 감정 값을 `CosyVoice instruction`으로 변환하는 부분
- 생성 결과를 문장 단위 오디오 URL로 저장하고 job 상태를 갱신하는 부분

내가 직접 구현하지 않아도 되는 범위:

- 동화 줄거리 생성, 스토리보드 생성, 삽화 생성, BGM 생성
- 프론트의 플레이어 UI, 페이지 전환, 재생 컨트롤
- 부모가 직접 녹음하는 `outro` 자산 생성
- 뷰어에서 outro를 마지막에 붙여 재생하는 UX
- 백엔드 전체 jobs 도메인 설계 자체

즉, AI/TTS 담당 범위는 `voice profile 준비 -> preview -> story sentence TTS`까지로 보고, `outro는 별도 녹음 자산`으로 다룹니다.

---

## 2. 핵심 개념

### 2.1 전통적인 보이스 클로닝과 차이

전통적인 방식은 아래 흐름입니다.

1. 사용자가 긴 시간 녹음
2. 사용자 전용 모델 파인튜닝
3. 학습된 모델 파일 저장
4. 이후 그 모델로 TTS 생성

이번 프로젝트에서 쓰려는 Zero-shot 방식은 아래 흐름입니다.

1. 사용자가 20초 내외로 녹음
2. 별도 학습 없음
3. 원본 WAV 또는 레퍼런스 오디오만 저장
4. TTS 생성 시마다 CosyVoice 모델에 레퍼런스 오디오를 다시 넣음

즉, 사용자 음성을 "모델로 만드는 것"이 아니라, `사용자 목소리 샘플을 저장하고 매번 참조하는 구조`입니다.

### 2.2 실제로 저장되는 것

저장되는 것:

- `reference.wav`
- `metadata.json`
- 선택적으로 `prompt cache` 또는 `embedding cache`

저장되지 않는 것:

- 사용자 전용 파인튜닝 모델
- 사용자별 대용량 모델 가중치

### 2.3 실제 생성 시 내부 동작

TTS 생성 시 서버 내부에서는 대략 아래 순서로 동작합니다.

1. `voiceId`로 레퍼런스 음성 경로 조회
2. `reference.wav`를 로드
3. CosyVoice 모델이 화자 특성을 내부적으로 추출
4. 텍스트와 화자 특성으로 음성 생성
5. 결과 오디오를 S3에 저장

필요하면 성능 최적화를 위해 아래 캐싱을 둘 수 있습니다.

- `reference.wav` 자체 재사용
- `voice prompt cache`
- `speaker embedding cache`

단, 캐시는 최적화용일 뿐이고, 기본 저장 대상은 어디까지나 `레퍼런스 음성 파일`입니다.

---

## 3. 설계 원칙

- 오래 걸리는 작업은 비동기로 처리합니다.
- 미리듣기와 노이즈 검사는 동기 처리도 가능합니다.
- 오디오 바이너리 파일은 S3에 저장합니다.
- API는 파일 자체가 아니라 상태, 메타데이터, S3 URL 또는 S3 key를 반환합니다.
- 문장 단위 음원을 정본으로 사용합니다.
- 전체 오디오북 파일은 파생 산출물로 취급합니다.
- 감정 제어는 별도 학습이 아니라 `생성 옵션`으로 처리합니다.

---

## 4. 보이스 등록 자산 구조

`voiceId` 하나에 대해 아래와 같은 자산을 관리하는 것을 권장합니다.

```text
voices/{voiceId}/reference.wav
voices/{voiceId}/metadata.json
voices/{voiceId}/prompt-cache.pkl
```

예시:

```text
voices/vce_abc123/reference.wav
voices/vce_abc123/metadata.json
voices/vce_abc123/prompt-cache.pkl
```

### 4.1 metadata.json 예시

```json
{
  "voiceId": "vce_abc123",
  "label": "엄마_해솔",
  "durationSec": 22.5,
  "sampleRate": 16000,
  "channels": 1,
  "language": "ko-KR",
  "createdAt": "2026-04-20T14:30:00Z",
  "cache": {
    "promptCached": true,
    "embeddingCached": false
  }
}
```

### 4.2 용어 정리

문서나 기획에서 "보이스 클론 모델"이라고 부를 수는 있지만, 실제 구현 관점에서는 아래처럼 이해하는 것이 정확합니다.

- 기획 용어: 보이스 클론 모델
- 실제 구현물: 레퍼런스 음성 + 메타데이터 + 선택적 캐시

즉, `기존에 생성한 보이스 클론 모델 재활용`의 실제 의미는 `기존에 등록한 reference.wav를 다시 사용`하는 것입니다.

### 4.3 ERD 기준 저장 책임

현재 ERD를 기준으로 보면 TTS 구현에서 직접 연결되는 핵심 저장 지점은 아래 네 군데입니다.

- `voice_profiles.audio_url`
  - 부모가 업로드한 원본 녹음 파일 URL
- `voice_profiles.tts_voice_url`
  - TTS에 실제로 재사용할 `reference.wav` 또는 그에 준하는 전처리 완료 파일 URL
- `scene_sentences.tts_audio_url`
  - 동화 문장별 TTS 결과 URL
- `story_outros.audio_url`
  - 부모가 직접 녹음한 outro 자산 URL

중요한 해석:

- `voice_profiles`는 TTS가 사용할 화자 자산 저장소입니다.
- `scene_sentences`는 내가 생성해야 하는 본문 문장 오디오의 최종 저장 지점입니다.
- `story_outros`는 ERD상 별도 자산 테이블이며, 부모가 직접 읽은 음성을 저장하는 용도입니다.
- 따라서 AI TTS 구현 범위에는 `story_outros.audio_url` 생성이 포함되지 않습니다.

---

## 5. 감정 읽기 기능

### 5.1 감정 제어 개념

감정 읽기는 사용자 목소리를 다시 학습시키는 기능이 아니라, TTS 생성 시점에 아래 요소를 조절하는 기능입니다.

- 말하기 속도
- 피치
- 볼륨
- pause
- prosody
- 감정 태그
- 문장별 스타일 프롬프트

모델이 직접 감정 라벨을 지원하면 그 값을 넘기고, 지원하지 않으면 내부적으로 prosody 옵션으로 변환합니다.

### 5.2 권장 감정 타입

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

실서비스에서는 처음부터 너무 많이 열지 말고 아래 정도부터 시작하는 것을 권장합니다.

- `NEUTRAL`
- `WARM`
- `HAPPY`
- `SOFT`
- `EXCITED`
- `NARRATION`

### 5.3 감정 제어 방식

아래 세 가지 방식 중 하나 또는 혼합으로 처리할 수 있습니다.

1. `emotion` 필드 직접 전달
2. `stylePrompt` 전달
3. `ssml` 전달

예시:

```json
{
  "emotion": "WARM",
  "stylePrompt": "Read gently like a caring mother at bedtime.",
  "ssml": "<speak><prosody rate=\"slow\" pitch=\"low\">Good night, Haesol.</prosody></speak>"
}
```

우선순위는 아래처럼 두는 것을 권장합니다.

1. `sentence.ssml`
2. `sentence.emotion` 또는 `sentence.stylePrompt`
3. 요청 공통 옵션 `options.defaultEmotion`
4. 기본값 `NARRATION`

### 5.4 CosyVoice 기준 감정 제어 구현 전략

CosyVoice README 기준으로 보면, 최신 계열은 단순히 텍스트만 읽는 모델이 아니라 `instruction` 기반 제어가 가능한 TTS 계층으로 보는 것이 맞습니다. 특히 Fun-CosyVoice 3.0은 language, dialect, emotion, speed, volume 같은 지시를 함께 줄 수 있으므로, 이 프로젝트의 감정 읽기 기능은 아래 방식으로 연결하는 것이 가장 자연스럽습니다.

1. 기본 음색/화자 정체성은 항상 `reference.wav`가 담당합니다.
2. 감정, 말하기 속도, 볼륨, 문장 스타일은 CosyVoice 입력 지시문으로 분리해서 제어합니다.
3. 즉 `voice cloning`과 `emotion control`은 같은 단계에서 합쳐지지만, 역할은 분리됩니다.
4. 따라서 `클로닝한 화자에 감정을 입히는` 기본 추론 경로는 `inference_zero_shot`이 아니라 `inference_instruct2` 계열로 보는 것이 맞습니다.

권장 모델 전략:

- 1순위: `Fun-CosyVoice3-0.5B`
- 2순위: `CosyVoice2-0.5B`
- 하위 호환: instruct 제어가 약한 모델은 `stylePrompt + prosody + ssml` fallback으로 처리

내부 매핑 원칙:

1. `reference.wav`로 화자 특성을 고정합니다.
2. `emotion` 값은 CosyVoice용 내부 instruction 문장으로 변환합니다.
3. `stylePrompt`는 instruction 뒤에 덧붙여 문장 분위기를 더 구체화합니다.
4. `ssml`이 있으면 prosody 관련 값은 SSML을 우선 적용합니다.
5. `speakingRate`, `pitch`, `volumeGain` 같은 수치 옵션은 instruction 또는 runtime option으로 같이 전달합니다.

즉, 외부 API는 아래처럼 단순하게 유지하고:

```json
{
  "emotion": "WARM",
  "stylePrompt": "다정한 엄마가 잠자리에서 읽어주듯 부드럽게 읽어줘.",
  "ssml": null
}
```

AI 서버 내부에서는 CosyVoice 입력용으로 아래와 같은 instruction으로 변환하는 구조를 권장합니다:

```text
Use the reference speaker's voice.
Speak in Korean.
Use a warm, gentle bedtime storytelling emotion.
Slightly slow speed, soft volume.
Additional style: 다정한 엄마가 잠자리에서 읽어주듯 부드럽게 읽어줘.
```

### 5.5 감정 값 -> CosyVoice instruction 매핑 예시

실서비스에서는 감정 enum을 너무 많이 열기보다, 먼저 5~6개 정도를 안정적으로 운영하는 편이 좋습니다.

- `NARRATION`
  - 기본 설명형 톤
  - instruction 예: `Read like a clear children's story narrator.`
- `WARM`
  - 따뜻하고 안정적인 부모 낭독 톤
  - instruction 예: `Speak warmly and gently, like a caring parent reading at bedtime.`
- `SOFT`
  - 작은 목소리, 마무리 인사, 잔잔한 감정
  - instruction 예: `Speak softly and calmly with a low, relaxed energy.`
- `EXCITED`
  - 놀람, 반가움, 장면 전환 강조
  - instruction 예: `Speak brightly and excitedly, but keep the pronunciation clear.`
- `HAPPY`
  - 전반적으로 밝고 가벼운 감정
  - instruction 예: `Speak cheerfully with a light and pleasant tone.`
- `SAD`
  - 차분하고 느린 감정
  - instruction 예: `Speak slowly and quietly with a subdued emotional tone.`

### 5.6 CosyVoice 사용 시 운영 규칙

- 감정 제어는 가능한 한 `emotion -> canonical instruction`으로 먼저 고정하고, 자유 입력은 `stylePrompt`로만 보강합니다.
- `stylePrompt`만 자유롭게 열어두면 같은 감정이어도 결과 편차가 커질 수 있으므로, 서비스 기본값은 enum 중심으로 유지하는 편이 안전합니다.
- 문장별 감정이 과하게 흔들리면 화자 일관성이 무너져 보일 수 있으므로, 기본값은 `NARRATION` 또는 `WARM`으로 두고 일부 문장만 강한 감정을 허용하는 것이 좋습니다.
- whisper, shout, very fast 같은 극단 지시는 zero-shot 화자 보존을 흔들 수 있으므로 제한된 preset으로 관리하는 것이 좋습니다.
- 한국어/영어/다국어 문장이 섞일 수 있으므로, instruction에는 언어 정보도 함께 넣는 편이 안정적입니다.
- CosyVoice 3 계열을 쓰더라도 API 레벨에서는 지금 정의한 `emotion`, `stylePrompt`, `ssml` 추상화를 유지해야 이후 모델 교체가 쉬워집니다.

### 5.7 클로닝 화자 + 감정 제어 API 설계 원칙

이 프로젝트에서 사용자가 기대하는 결과는 단순 감정 TTS가 아니라, `등록한 보이스(reference.wav)`를 유지한 채 감정을 입힌 출력입니다. 따라서 API는 아래 원칙으로 설계하는 것이 맞습니다.

1. 외부 API에서 `voiceId`와 `emotion`은 분리된 선택 옵션이 아니라, `화자 복제`와 `감정 제어`를 구성하는 핵심 입력으로 취급합니다.
2. preview, story 같은 실제 생성 API는 모두 `voiceId`를 기준으로 `reference.wav`를 찾고, 감정은 반드시 `emotion` 또는 `defaultEmotion`으로 받습니다.
3. AI worker는 외부 요청을 그대로 CosyVoice에 넘기지 않고, `emotion -> canonical instruct_text` 변환을 먼저 수행합니다.
4. `stylePrompt`, `ssml`, `speakingRate`, `pitch`, `volumeGain`은 감정을 보강하는 입력이며, 감정을 대체하는 자유 입력으로 취급하지 않습니다.
5. `emotion`이 필수인 API에서는 CosyVoice 내부 호출도 기본적으로 `inference_instruct2`를 사용합니다.
6. `inference_zero_shot`은 감정 없는 순수 화자 복제 실험이나 fallback 용도로만 남기고, 공개 API 기본 경로로는 두지 않습니다.

내부 worker 기준 권장 변환 흐름:

1. `voiceId`로 `reference.wav`를 조회합니다.
2. 요청의 `emotion` 값을 표준 instruction 문장으로 변환합니다.
3. `stylePrompt`가 있으면 instruction 뒤에 덧붙입니다.
4. `language`, `speakingRate`, `pitch`, `volumeGain` 정보를 추가해 최종 `instruct_text`를 만듭니다.
5. CosyVoice에는 `tts_text + instruct_text + prompt_wav(reference.wav)` 조합으로 전달합니다.

권장 내부 payload 개념 예시:

```json
{
  "ttsText": "잘 자, 우리 아가.",
  "instructText": "Use the reference speaker's voice. Speak in Korean. Speak warmly and gently like a caring parent at bedtime. Slightly slow speed, soft volume.",
  "promptWavPath": "processed/voices/vce_abc123/reference.wav",
  "engine": "cosyvoice.inference_instruct2"
}
```

### 5.8 RabbitMQ 비동기 처리 원칙

이 프로젝트에서 RabbitMQ 비동기 job으로 다뤄야 하는 핵심 작업은 `VOICE_CLONE`, `TTS` 두 가지입니다.

- `VOICE_CLONE`
  - 원본 녹음을 전처리해 `reference.wav`를 만드는 작업
- `TTS`
  - 동화 문장 단위 오디오를 생성하는 작업

- backend는 요청을 받으면 먼저 job을 생성하고 상태를 `PENDING`으로 저장합니다.
- backend는 job payload를 RabbitMQ exchange에 publish 합니다.
- AI worker consumer는 queue에서 메시지를 consume 하고 실제 CosyVoice 추론을 수행합니다.
- 작업 시작 시 job 상태는 `RUNNING`, 완료 시 `SUCCESS`, 실패 시 `FAILED`로 갱신합니다.
- 결과 파일은 S3와 manifest에 저장하고, backend는 `GET /api/v1/jobs/{jobId}` 조회로 상태와 결과를 노출합니다.
- 반복 실패 메시지는 DLQ(dead letter queue)로 보내는 구조를 권장합니다.

추가 판단:

- `preview`는 짧은 텍스트 기준 확인용 기능이므로 1차 구현에서는 동기 처리해도 됩니다.
- `noise-check`는 별도 공개 job 타입으로 두기보다 voice 등록 전처리 내부 단계로 흡수해도 충분합니다.
- `outro`는 부모가 직접 녹음하는 자산이므로 RabbitMQ TTS job 범위에 넣지 않습니다.

권장 메시징 구조 예시:

- exchange: `tts.command`
- routing key:
  - `voice.register`
  - `tts.story`
- queue:
  - `tts.voice.register`
  - `tts.story`

결과 이벤트를 MQ로 되돌리는 패턴을 쓸 경우에는 아래처럼 `command`와 `result`를 분리하는 것을 권장합니다.

- command exchange: `tts.command`
  - backend -> ai worker 명령 전달
- result exchange: `tts.result`
  - ai worker -> backend 결과 이벤트 전달
- command routing key:
  - `voice.register`
  - `tts.story`
- result routing key:
  - `voice.register.succeeded`
  - `voice.register.failed`
  - `tts.story.succeeded`
  - `tts.story.failed`
- command queue:
  - `tts.voice.register`
  - `tts.story`
- result queue:
  - `backend.tts.result`

즉, 팀원이 말한 "보낼 때 MQ 하나, 처리 후 응답 보낼 때 MQ 하나" 구조는 충분히 타당합니다. 다만 엄밀히는 `요청/응답 RPC`라기보다 `명령 이벤트(command) + 결과 이벤트(result)` 구조로 구현하는 편이 더 맞습니다.

---

## 6. 공통 응답 형식

### 6.1 성공

```json
{
  "success": true,
  "data": {},
  "message": null
}
```

### 6.2 실패

```json
{
  "success": false,
  "error": {
    "code": "VOICE_NOISE_DETECTED",
    "message": "보이스 등록에 사용할 수 없을 정도로 노이즈가 큽니다."
  }
}
```

### 6.3 비동기 작업 접수

```json
{
  "success": true,
  "data": {
    "jobId": "job_01JTS8JWQ39W4QG6F0JX8S6AVC",
    "jobType": "VOICE_CLONE",
    "status": "PENDING"
  },
  "message": null
}
```

---

## 7. 공통 상태값과 타입

### 7.1 Job 상태

- `PENDING`
- `RUNNING`
- `SUCCESS`
- `FAILED`
- `CANCELLED`

### 7.2 Job 종류

- `VOICE_CLONE`
- `TTS`

ERD 기준 `story_generation_jobs.job_type`에도 `VOICE_CLONE`, `TTS`가 이미 있으므로, 1차 구현 문서는 이 두 타입에 맞춰 정리하는 편이 안전합니다.

### 7.3 오디오 포맷

- 입력 포맷
  - `wav`
  - `mp3`
  - `m4a`
  - `webm`
- 출력 포맷
  - 기본 `mp3`
  - 선택 `wav`

### 7.4 감정 타입

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

---

## 8. S3 객체 규칙

권장 S3 key 패턴은 아래와 같습니다.

```text
raw/voice-register/{voiceId}/original/{filename}
processed/voices/{voiceId}/reference.wav
processed/voices/{voiceId}/metadata.json
cache/voices/{voiceId}/prompt-cache.pkl
generated/voice-preview/{voiceId}/{requestId}.mp3
generated/story-tts/{storyId}/sentences/{sentenceId}.mp3
generated/story-tts/{storyId}/full-book/full-book.mp3
manifests/jobs/{jobId}/result.json
```

`outro`는 TTS 생성물이 아니라 부모가 직접 녹음한 자산이므로, 이 문서의 권장 S3 규칙 범위에서는 제외합니다. 필요하면 별도 규칙으로 `recorded/outros/{storyId}/outro.{ext}` 정도를 정의하면 됩니다.

결과 파일마다 함께 관리하면 좋은 메타데이터는 아래와 같습니다.

- `s3Key`
- `s3Url`
- `contentType`
- `durationMs`
- `sampleRate`
- `sizeBytes`
- `createdAt`

---

## 9. API 목록

### 9.0 API 설계 기본 원칙

외부 API는 우리 서비스 도메인 기준으로 설계하고, CosyVoice의 세부 엔드포인트는 AI worker 내부 구현으로 숨깁니다.

- 외부 API는 `voiceId`, `emotion`, `stylePrompt`, `ssml` 같은 제품 개념을 그대로 받습니다.
- 내부 worker는 이를 CosyVoice 입력 형식인 `tts_text`, `instruct_text`, `prompt_wav`로 변환합니다.
- `클로닝한 화자 + 감정 제어`가 필요한 공개 API는 모두 내부적으로 `CosyVoice /inference_instruct2` 경로를 기본 사용합니다.
- `CosyVoice /inference_zero_shot`은 감정 없는 테스트, fallback, 비교 실험 용도로만 제한합니다.
- 외부 응답에는 CosyVoice 원문 instruction 전체를 노출하지 않고, `appliedStyle`, `resolvedEmotion`, `resolvedVoiceId` 같은 정리된 형태만 반환합니다.
- 구현 우선순위는 `voice register -> preview -> story sentence TTS` 순서로 둡니다.
- `outro`는 부모 직접 녹음 자산으로 보고, 본 문서의 AI TTS 공개 API 범위에서 제외합니다.

외부 API -> 내부 worker -> CosyVoice 흐름 예시:

1. 프론트가 `POST /api/v1/voices/{voiceId}/preview`를 호출합니다.
2. AI 서버는 `voiceId`로 `reference.wav`를 찾습니다.
3. AI 서버는 `emotion`과 `stylePrompt`를 합쳐 `instruct_text`를 만듭니다.
4. AI 서버는 CosyVoice `inference_instruct2`로 `tts_text + instruct_text + prompt_wav`를 전송합니다.
5. CosyVoice가 반환한 오디오를 저장합니다.
6. backend는 최종적으로 정리된 audio URL과 적용 스타일 정보를 사용자에게 반환합니다.

### 9.1 POST `/api/v1/voices`

사용자 보이스를 등록합니다.

이 API 이름은 `voice clone` 대신 `voice register`에 가깝지만, 제품 용어상 보이스 클론 생성 단계로 볼 수 있습니다.

#### 목적

- 업로드된 음성 파일 검증
- webm, m4a 등을 기준 WAV로 변환
- 필요 시 노이즈 검사 수행
- `reference.wav` 저장
- 메타데이터 생성
- 선택적으로 prompt cache 생성

#### 요청

```json
{
  "label": "엄마_해솔",
  "sourceAudio": {
    "s3Key": "raw/voice-register/temp/user-101/mom-recording.webm"
  },
  "scriptText": "안녕 해솔아. 오늘은 우리 가족 여행 이야기를 들려줄게.",
  "language": "ko-KR",
  "options": {
    "runNoiseCheck": true,
    "trimSilence": true,
    "normalizeVolume": true,
    "generatePromptCache": true
  }
}
```

#### 요청 필드

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `label` | string | Y | 사용자에게 보여줄 보이스 이름 |
| `sourceAudio.s3Key` | string | Y | 업로드된 원본 파일의 S3 key |
| `scriptText` | string | N | 읽은 스크립트 원문 |
| `language` | string | Y | 언어 태그 |
| `options.runNoiseCheck` | boolean | N | 노이즈 검사 수행 여부 |
| `options.trimSilence` | boolean | N | 앞뒤 무음 제거 여부 |
| `options.normalizeVolume` | boolean | N | 볼륨 정규화 여부 |
| `options.generatePromptCache` | boolean | N | prompt cache 생성 여부 |

#### 응답

```json
{
  "success": true,
  "data": {
    "jobId": "job_01JTS8JWQ39W4QG6F0JX8S6AVC",
    "jobType": "VOICE_CLONE",
    "status": "PENDING",
    "voiceId": "vce_abc123"
  },
  "message": null
}
```

#### 작업 완료 후 조회 예시

```json
{
  "success": true,
  "data": {
    "jobId": "job_01JTS8JWQ39W4QG6F0JX8S6AVC",
    "jobType": "VOICE_CLONE",
    "status": "SUCCESS",
    "progress": 100,
    "result": {
      "voiceId": "vce_abc123",
      "label": "엄마_해솔",
      "referenceAudio": {
        "s3Key": "processed/voices/vce_abc123/reference.wav",
        "s3Url": "https://cdn.example.com/processed/voices/vce_abc123/reference.wav"
      },
      "metadata": {
        "durationSec": 22.5,
        "sampleRate": 16000,
        "channels": 1,
        "language": "ko-KR"
      },
      "quality": {
        "noisePassed": true,
        "noiseScore": 0.08
      },
      "cache": {
        "promptCached": true,
        "promptCacheKey": "cache/voices/vce_abc123/prompt-cache.pkl"
      }
    }
  },
  "message": null
}
```

#### 실패 예시

```json
{
  "success": false,
  "error": {
    "code": "VOICE_NOISE_DETECTED",
    "message": "보이스 등록에 사용할 수 없을 정도로 노이즈가 큽니다."
  }
}
```

### 9.2 GET `/api/v1/voices/{voiceId}`

등록된 보이스 정보를 조회합니다.

#### 응답

```json
{
  "success": true,
  "data": {
    "voiceId": "vce_abc123",
    "label": "엄마_해솔",
    "status": "SUCCESS",
    "language": "ko-KR",
    "referenceAudioUrl": "https://cdn.example.com/processed/voices/vce_abc123/reference.wav",
    "durationSec": 22.5,
    "cache": {
      "promptCached": true
    },
    "createdAt": "2026-04-22T10:00:00Z"
  },
  "message": null
}
```

### 9.3 POST `/api/v1/voices/{voiceId}/preview`

등록된 보이스로 짧은 문장을 읽어 미리듣기 오디오를 생성합니다.

#### 목적

- 사용자가 목소리 유사도를 빠르게 확인
- 클로닝된 화자에 감정이 제대로 입혀지는지 확인
- 실제 동화 생성 전에 톤 조정

#### 요청

```json
{
  "text": "잘 자, 우리 아가.",
  "language": "ko-KR",
  "format": "mp3",
  "options": {
    "emotion": "WARM",
    "stylePrompt": "다정한 엄마가 잠자리에서 읽어주듯 부드럽게 읽어줘.",
    "speakingRate": 0.92,
    "pitch": -0.5,
    "volumeGain": 1.0,
    "useSsml": false
  }
}
```

#### 요청 필드

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `text` | string | Y | 읽을 텍스트 |
| `language` | string | Y | 출력 언어 |
| `format` | string | N | 출력 포맷 |
| `options.emotion` | string | Y | 클로닝된 화자에 적용할 감정 타입 |
| `options.stylePrompt` | string | N | 자유 형식 스타일 프롬프트 |
| `options.speakingRate` | number | N | 속도 |
| `options.pitch` | number | N | 피치 |
| `options.volumeGain` | number | N | 볼륨 게인 |
| `options.useSsml` | boolean | N | SSML 사용 여부 |

이 API의 내부 구현 원칙:

- `voiceId`로 `reference.wav`를 조회합니다.
- `options.emotion`은 필수이며, 누락 시 요청을 거절합니다.
- preview는 짧은 확인용 기능이므로 1차 구현에서는 동기 처리합니다.
- AI 서버는 내부적으로 `CosyVoice /inference_instruct2`를 직접 호출합니다.
- preview 결과는 임시 오디오 산출물로 보고, `scene_sentences` 같은 본문 정본 테이블에는 반영하지 않습니다.
- preview 응답에는 실제로 적용된 감정과 스타일만 요약해서 반환합니다.

#### 응답

```json
{
  "success": true,
  "data": {
    "previewId": "preview_01JTS8P0MQQ0JH17EEA6YJ3WF2",
    "audio": {
      "s3Key": "generated/voice-preview/vce_abc123/preview_01JTS8P0MQQ0JH17EEA6YJ3WF2.mp3",
      "s3Url": "https://cdn.example.com/generated/voice-preview/vce_abc123/preview_01JTS8P0MQQ0JH17EEA6YJ3WF2.mp3",
      "durationMs": 2750,
      "format": "mp3"
    },
    "appliedStyle": {
      "emotion": "WARM",
      "speakingRate": 0.92,
      "pitch": -0.5
    }
  },
  "message": null
}
```

### 9.4 POST `/api/v1/tts/story`

동화 문장 목록을 받아 문장 단위 TTS를 생성합니다.

#### 목적

- 각 문장별 음원 생성
- 문장별로 클로닝된 화자에 감정, 스타일, SSML 개별 적용
- 문장별 개별 저장
- 선택적으로 전체 오디오북 파일 생성

#### 요청

```json
{
  "storyId": 1201,
  "voiceId": "vce_abc123",
  "language": "en-US",
  "format": "mp3",
  "options": {
    "defaultEmotion": "NARRATION",
    "defaultStylePrompt": "부모가 아이에게 동화를 읽어주듯 따뜻하고 또렷하게 읽어줘.",
    "generateFullBookAudio": true,
    "speakingRate": 0.94,
    "pitch": 0.0,
    "volumeGain": 1.0,
    "useSsml": true
  },
  "sentences": [
    {
      "sentenceId": 5001,
      "pageNumber": 1,
      "sentenceOrder": 1,
      "text": "Mina saw the ocean for the first time.",
      "speakerKey": "narrator",
      "emotion": "WARM",
      "stylePrompt": "경이롭고 따뜻한 설명 톤으로 읽어줘.",
      "ssml": null
    },
    {
      "sentenceId": 5002,
      "pageNumber": 1,
      "sentenceOrder": 2,
      "text": "\"Wow,\" she whispered.",
      "speakerKey": "mina",
      "emotion": "EXCITED",
      "stylePrompt": "아이의 설렘이 느껴지게 짧고 밝게 읽어줘.",
      "ssml": "<speak><prosody volume=\"soft\" rate=\"medium\">Wow</prosody>, she whispered.</speak>"
    }
  ]
}
```

#### 요청 필드

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `storyId` | number | Y | 동화 식별자 |
| `voiceId` | string | Y | 사용할 보이스 ID |
| `language` | string | Y | 출력 언어 |
| `format` | string | N | 출력 포맷 |
| `options.defaultEmotion` | string | Y | 모든 문장에 적용할 기본 감정 |
| `options.defaultStylePrompt` | string | N | 문장 기본 스타일 프롬프트 |
| `options.generateFullBookAudio` | boolean | N | 전체 오디오북 파일 생성 여부 |
| `options.speakingRate` | number | N | 기본 말하기 속도 |
| `options.pitch` | number | N | 기본 피치 |
| `options.volumeGain` | number | N | 기본 볼륨 |
| `options.useSsml` | boolean | N | SSML 사용 여부 |
| `sentences` | array | Y | 생성할 문장 목록 |
| `sentences[].sentenceId` | number | Y | 문장 식별자 |
| `sentences[].pageNumber` | number | Y | 페이지 번호 |
| `sentences[].sentenceOrder` | number | Y | 문장 순서 |
| `sentences[].text` | string | Y | 일반 텍스트 |
| `sentences[].speakerKey` | string | N | 화자 역할 |
| `sentences[].emotion` | string | N | 문장별 감정 override. 없으면 `options.defaultEmotion` 사용 |
| `sentences[].stylePrompt` | string | N | 문장별 스타일 설명 |
| `sentences[].ssml` | string or null | N | 문장별 SSML |

이 API의 내부 구현 원칙:

- story 전체는 하나의 `voiceId`를 기준으로 같은 `reference.wav`를 사용합니다.
- 모든 문장은 반드시 최종 감정 값을 가져야 하며, 우선순위는 `sentences[].emotion` -> `options.defaultEmotion` 입니다.
- worker는 문장마다 별도 `instruct_text`를 만들고, 내부적으로 `CosyVoice /inference_instruct2`를 반복 호출합니다.
- 생성 완료 후 각 결과 URL은 `scene_sentences.tts_audio_url`에 반영하는 것을 기준 저장으로 삼습니다.
- `fullBookAudio`는 문장별 결과를 모두 생성한 뒤 후처리로 병합합니다.
- `fullBookAudio`는 파생 산출물이며, DB 정본보다는 job result payload 또는 manifest에서 관리하는 편이 맞습니다.

#### 응답

```json
{
  "success": true,
  "data": {
    "jobId": "job_01JTS8W0S00EZY8W1KC9PMD1NA",
    "jobType": "TTS",
    "status": "PENDING",
    "storyId": 1201
  },
  "message": null
}
```

#### 작업 완료 후 조회 예시

```json
{
  "success": true,
  "data": {
    "jobId": "job_01JTS8W0S00EZY8W1KC9PMD1NA",
    "jobType": "TTS",
    "status": "SUCCESS",
    "progress": 100,
    "result": {
      "storyId": 1201,
      "voiceId": "vce_abc123",
      "items": [
        {
          "sentenceId": 5001,
          "appliedStyle": {
            "emotion": "WARM",
            "stylePrompt": "경이롭고 따뜻한 설명 톤으로 읽어줘."
          },
          "audio": {
            "s3Key": "generated/story-tts/1201/sentences/5001.mp3",
            "s3Url": "https://cdn.example.com/generated/story-tts/1201/sentences/5001.mp3",
            "durationMs": 3120,
            "format": "mp3"
          }
        },
        {
          "sentenceId": 5002,
          "appliedStyle": {
            "emotion": "EXCITED",
            "stylePrompt": "아이의 설렘이 느껴지게 짧고 밝게 읽어줘."
          },
          "audio": {
            "s3Key": "generated/story-tts/1201/sentences/5002.mp3",
            "s3Url": "https://cdn.example.com/generated/story-tts/1201/sentences/5002.mp3",
            "durationMs": 1850,
            "format": "mp3"
          }
        }
      ],
      "fullBookAudio": {
        "s3Key": "generated/story-tts/1201/full-book/full-book.mp3",
        "s3Url": "https://cdn.example.com/generated/story-tts/1201/full-book/full-book.mp3",
        "durationMs": 4970,
        "format": "mp3"
      },
      "summary": {
        "sentenceCount": 2,
        "totalDurationMs": 4970,
        "costUsd": 0.0342
      }
    }
  },
  "message": null
}
```

### 9.5 GET `/api/v1/jobs/{jobId}`

비동기 작업 상태와 결과를 조회합니다.

#### 진행 중 응답 예시

```json
{
  "success": true,
  "data": {
    "jobId": "job_01JTS8W0S00EZY8W1KC9PMD1NA",
    "jobType": "TTS",
    "status": "RUNNING",
    "progress": 45,
    "startedAt": "2026-04-22T10:05:00Z",
    "finishedAt": null,
    "result": null,
    "error": null
  },
  "message": null
}
```

#### 실패 응답 예시

```json
{
  "success": true,
  "data": {
    "jobId": "job_01JTS8W0S00EZY8W1KC9PMD1NA",
    "jobType": "TTS",
    "status": "FAILED",
    "progress": 60,
    "startedAt": "2026-04-22T10:05:00Z",
    "finishedAt": "2026-04-22T10:06:08Z",
    "result": null,
    "error": {
      "code": "AI_PROVIDER_ERROR",
      "message": "문장 5008 생성 중 TTS 제공자 타임아웃이 발생했습니다."
    }
  },
  "message": null
}
```

---

## 10. 동작 예시

### 10.1 예시 A: 보이스 등록

#### 1단계. 사용자가 브라우저에서 녹음

사용자는 약 20초 정도 스크립트를 읽습니다.

예:

```text
안녕 해솔아. 오늘은 우리 가족 여행 이야기를 들려줄게.
```

브라우저에서 녹음된 파일 예시:

```text
mom-recording.webm
```

#### 2단계. 원본 파일을 S3에 업로드

예시:

```text
raw/voice-register/temp/user-101/mom-recording.webm
```

#### 3단계. 보이스 등록 API 호출

```http
POST /api/v1/voices
Content-Type: application/json
```

```json
{
  "label": "엄마_해솔",
  "sourceAudio": {
    "s3Key": "raw/voice-register/temp/user-101/mom-recording.webm"
  },
  "scriptText": "안녕 해솔아. 오늘은 우리 가족 여행 이야기를 들려줄게.",
  "language": "ko-KR",
  "options": {
    "runNoiseCheck": true,
    "trimSilence": true,
    "normalizeVolume": true,
    "generatePromptCache": true
  }
}
```

#### 4단계. AI 서버 처리

AI 서버는 아래 순서로 처리합니다.

1. S3에서 원본 파일 다운로드
2. ffmpeg로 `16kHz mono wav` 변환
3. 무음 제거
4. 노이즈 검사
5. `reference.wav` 저장
6. `metadata.json` 저장
7. 필요 시 `prompt-cache.pkl` 생성

결과적으로 저장되는 것은 아래입니다.

```text
processed/voices/vce_abc123/reference.wav
processed/voices/vce_abc123/metadata.json
cache/voices/vce_abc123/prompt-cache.pkl
```

중요:

- 이 단계에서 사용자 전용 모델 학습은 없습니다.
- 저장되는 핵심 자산은 `reference.wav`입니다.

### 10.2 예시 B: 미리듣기 생성

#### 1단계. 보이스 ID로 미리듣기 요청

```http
POST /api/v1/voices/vce_abc123/preview
Content-Type: application/json
```

```json
{
  "text": "잘 자, 우리 아가.",
  "language": "ko-KR",
  "format": "mp3",
  "options": {
    "emotion": "WARM",
    "stylePrompt": "다정한 엄마가 잠자리에서 읽어주듯 부드럽게 읽어줘.",
    "speakingRate": 0.92,
    "pitch": -0.5,
    "volumeGain": 1.0,
    "useSsml": false
  }
}
```

#### 2단계. 서버 내부 처리

1. `voiceId`로 `reference.wav` 위치 조회
2. 필요 시 `prompt-cache.pkl` 사용
3. CosyVoice 모델에 `text + reference.wav + emotion/style` 전달
4. 결과 mp3 생성 후 S3 업로드

즉, 미리듣기에서도 별도 학습은 없고 `reference.wav`를 다시 사용하는 구조입니다.

### 10.3 예시 C: 동화 15페이지 TTS 생성

예를 들어 15페이지 분량 동화를 만든다고 가정하면, 내부적으로는 아래처럼 동작합니다.

1. `voiceId`로 `reference.wav` 조회
2. 페이지별 문장 목록 순회
3. 각 문장마다 CosyVoice 모델에 레퍼런스 음성 재투입
4. 문장별 mp3 저장
5. 필요 시 full-book mp3 병합

즉 아래 개념입니다.

```text
CosyVoice 모델 1개
+ 사용자 reference.wav
+ 현재 문장 text
+ 감정 옵션
= 문장 오디오 생성
```

### 10.4 예시 D: 감정 읽기 적용

예를 들어 아래 두 문장을 서로 다른 감정으로 읽게 할 수 있습니다.

문장 1:

```json
{
  "sentenceId": 5001,
  "text": "Mina saw the ocean for the first time.",
  "emotion": "WARM",
  "stylePrompt": "따뜻한 내레이션 톤으로 읽어줘."
}
```

문장 2:

```json
{
  "sentenceId": 5002,
  "text": "\"Wow,\" she whispered.",
  "emotion": "EXCITED",
  "stylePrompt": "아이의 설렘이 느껴지게 짧고 밝게 읽어줘."
}
```

이 경우 같은 부모 목소리 레퍼런스를 쓰더라도 감정 스타일은 다르게 적용할 수 있습니다.

즉:

- `화자 정체성`은 `reference.wav`가 담당
- `읽는 감정`은 `emotion`, `stylePrompt`, `ssml`이 담당

---

## 11. 권장 검증 규칙

### 11.1 보이스 등록

- 오디오 길이: 권장 15초에서 30초
- 주요 화자는 한 명이어야 함
- 배경 음악이 감지되면 거절
- 노이즈 점수가 기준을 넘으면 거절
- 샘플레이트와 채널 수는 내부적으로 표준화

### 11.2 미리듣기 TTS

- 텍스트 길이 최대 300자
- 빈 문자열 금지
- 감정 타입은 허용 목록 내 값만 허용

### 11.3 동화 TTS

- 문장 목록은 비어 있으면 안 됨
- 각 문장에는 `sentenceId`가 반드시 있어야 함
- 각 문장 텍스트는 비어 있으면 안 됨
- 배치 크기를 초과하면 거절 또는 분할
- `emotion`, `stylePrompt`, `ssml`의 우선순위 충돌 규칙을 명확히 적용

### 11.4 감정 옵션 해석 우선순위

권장 우선순위는 아래와 같습니다.

1. `sentence.ssml`
2. `sentence.emotion`
3. `sentence.stylePrompt`
4. `options.defaultEmotion`
5. `options.defaultStylePrompt`
6. 시스템 기본값

---

## 12. 권장 내부 구성 요소

- `voice_service`
  - 보이스 등록
  - 보이스 조회
  - reference.wav 저장
  - metadata 저장
  - 선택적 cache 생성
  - 완료 시 `voice_profiles.tts_voice_url` 반영
- `tts_service`
  - 요청 검증
  - 작업 생성
  - 결과 manifest 구성
  - 문장별 스타일 적용
- `emotion_mapper`
  - emotion 값을 모델별 파라미터로 변환
  - stylePrompt를 내부 프롬프트 형식으로 변환
  - 모델이 emotion 직접 미지원일 때 prosody로 변환
- `noise_check_service`
  - 노이즈 수치 계산
  - 클리핑, 무음 구간 이상 탐지
- `audio_preprocess_service`
  - 포맷 변환
  - 16kHz mono wav 변환
  - 볼륨 정규화
  - 무음 제거
- `prompt_cache_service` (선택)
  - prompt cache 저장
  - embedding cache 저장
  - 재사용 전략 관리
- `s3_client`
  - 원본 다운로드
  - 결과 업로드
- `job_service`
  - job 생성
  - 진행률 갱신
  - 결과 및 에러 저장
- `job_publisher`
  - backend job payload를 RabbitMQ exchange로 publish
  - jobType별 routing key 선택
- `job_consumer`
  - RabbitMQ queue consume
  - 실제 CosyVoice 추론 worker 실행
  - retry / DLQ 정책 처리
- `job_result_updater`
  - worker 완료/실패 결과를 job 상태에 반영
  - result manifest, error code, progress 갱신
  - story TTS 완료 시 `scene_sentences.tts_audio_url` 반영

---

## 13. 최소 구현 순서

1. `POST /api/v1/voices`
2. `GET /api/v1/voices/{voiceId}`
3. `POST /api/v1/voices/{voiceId}/preview`
4. `POST /api/v1/tts/story`
5. `GET /api/v1/jobs/{jobId}`

이 순서대로 구현하면 가장 빨리 end-to-end 흐름을 만들 수 있습니다.

- 녹음 업로드
- 보이스 등록
- 미리듣기 TTS
- 감정 옵션 확인
- 동화 전체 TTS 생성
- RabbitMQ publish / consume

참고:

- 별도 `noise-check` 공개 API는 1차 구현 범위에서 제외하고, voice 등록 내부 검증 단계로 흡수합니다.
- `outro`는 부모 직접 녹음 자산이므로 이 구현 순서에 포함하지 않습니다.

---

## 14. 최종 정리

이 프로젝트의 보이스 기능은 아래처럼 이해하면 정확합니다.

- 사용자별 "학습된 모델"을 만드는 것이 아님
- 사용자별 `reference.wav`를 저장하는 구조
- CosyVoice 모델은 모든 사용자가 공유
- 생성할 때마다 `reference.wav`를 다시 넣어 화자 특성을 반영
- 감정 읽기는 모델 재학습이 아니라 생성 옵션으로 제어
- 본문 문장 오디오는 `scene_sentences.tts_audio_url`에 반영하는 것이 1차 목표
- 부모 직접 녹음 outro는 `story_outros.audio_url`로 별도 관리

즉, 이 프로젝트에서 재활용되는 것은 `개인 모델`이 아니라 `개인 레퍼런스 음성`입니다.

---

## 15. 실제 동작 흐름 예시

아래는 "엄마 목소리로 동화 1권을 읽어주는" 시나리오를 기준으로, 사용자가 버튼을 누른 뒤 내부에서 어떤 순서로 동작하는지 정리한 예시입니다.

### 15.1 예시 시나리오

- 사용자는 앱에서 20초 정도 음성을 녹음합니다.
- 백엔드는 녹음 파일을 S3에 올린 뒤 `POST /api/v1/voices`를 호출해 voice 등록 job을 생성합니다.
- 백엔드는 생성한 voice job payload를 RabbitMQ에 publish 합니다.
- AI worker는 RabbitMQ에서 voice 등록 메시지를 consume 하고, 녹음 파일을 전처리해 `reference.wav`를 만든 뒤 voice 자산으로 저장합니다.
- 사용자는 "미리 듣기" 버튼을 눌러 짧은 문장 1개를 먼저 생성해 봅니다.
- 결과가 괜찮으면 동화 전체 문장 목록으로 `POST /api/v1/tts/story`를 호출합니다.
- 백엔드는 story job을 RabbitMQ에 publish 하고, AI worker는 각 문장마다 같은 `reference.wav`를 다시 넣어 CosyVoice로 음성을 생성합니다.
- 문장별 mp3와 필요 시 full-book mp3를 저장합니다.

### 15.2 단계별 내부 흐름

1. 앱에서 사용자가 음성을 녹음합니다.
2. 프론트엔드는 원본 오디오를 업로드하고, 백엔드는 업로드된 S3 key를 확보합니다.
3. 백엔드는 `POST /api/v1/voices` 요청을 처리하면서 job을 만들고, RabbitMQ에 `voice.register` 메시지를 publish 합니다.
4. AI worker의 `job_consumer`는 해당 메시지를 consume 하고, `voice_service`가 원본 오디오를 내려받아 wav 변환, trim, normalize, noise check를 수행합니다.
5. 전처리가 끝나면 `processed/voices/{voiceId}/reference.wav`와 `metadata.json`을 저장합니다.
6. 필요하면 `prompt-cache.pkl` 같은 캐시 자산도 함께 생성하고, worker는 결과를 job 상태에 반영합니다.
7. 사용자가 미리듣기를 요청하면 AI 서버는 저장된 `reference.wav`를 읽고, preview 문장과 `emotion`, `stylePrompt`를 즉시 CosyVoice 입력으로 조합합니다.
8. CosyVoice가 짧은 mp3를 생성하면 이를 S3에 저장하고, 백엔드는 결과 URL을 바로 사용자에게 반환합니다.
9. 사용자가 동화 전체 생성을 누르면 백엔드는 story job을 만들고 RabbitMQ에 `tts.story` 메시지를 publish 합니다.
10. AI worker는 문장 배열을 순회하면서 각 문장마다 `text + reference.wav + emotion/stylePrompt/ssml` 조합으로 CosyVoice를 호출합니다.
11. 생성된 각 문장 mp3는 `generated/story-tts/{storyId}/sentences/{sentenceId}.mp3`에 저장됩니다.
12. 생성이 끝나면 각 문장 결과 URL을 `scene_sentences.tts_audio_url`에 반영합니다.
13. `generateFullBookAudio=true`이면 문장 결과를 기준으로 full-book mp3도 함께 생성합니다.
14. 모든 작업이 끝나면 job 상태는 `SUCCESS`가 되고, 백엔드는 `GET /api/v1/jobs/{jobId}` 또는 후속 조회 API로 문장별 audio URL과 full-book URL을 사용자에게 내려줍니다.

### 15.3 이 흐름에서 중요한 포인트

- voice 등록 단계에서 새 TTS 모델을 학습하는 것이 아니라, 이후 재사용할 `reference.wav`를 안정적으로 만드는 것이 핵심입니다.
- 실제 무거운 추론은 HTTP 요청 안에서 바로 끝내지 않고, RabbitMQ에 publish 한 뒤 worker가 비동기로 처리하는 구조를 기본으로 합니다.
- 미리듣기와 동화 전체 생성은 모두 같은 `reference.wav`를 다시 사용합니다.
- 감정 표현 차이는 새로운 화자를 만드는 과정이 아니라, 생성 시점의 `emotion`, `stylePrompt`, `ssml` 조합으로 제어합니다.
- 동화 전체를 생성할 때도 문장마다 같은 화자 기준을 유지해야 하므로, 각 문장 생성 시 `reference.wav`가 계속 재투입됩니다.
- `outro`는 본문 TTS와 별도입니다. 부모 직접 녹음 자산은 `story_outros.audio_url`로 관리하고, 이 문서의 AI 추론 범위에는 넣지 않습니다.
- 즉 "엄마 목소리"라는 화자 정체성은 `reference.wav`가 담당하고, "따뜻하게", "신나게", "천천히" 같은 읽기 스타일은 문장 옵션이 담당합니다.

### 15.4 MQ 두 개를 쓰는 경우의 동작 과정

RabbitMQ를 `backend -> ai 명령 전달`과 `ai -> backend 결과 전달` 두 단계로 나누면, 흐름은 아래처럼 정리할 수 있습니다.

#### 1단계. backend가 command MQ에 작업 발행

1. 프론트가 `POST /api/v1/voices` 또는 `POST /api/v1/tts/story`를 호출합니다.
2. backend는 먼저 `story_generation_jobs`에 job row를 만들고 상태를 `PENDING`으로 저장합니다.
3. backend는 `tts.command` exchange에 메시지를 publish 합니다.
4. 이 메시지는 `tts.voice.register` 또는 `tts.story` queue로 라우팅됩니다.

command payload 예시:

```json
{
  "jobId": 901,
  "jobType": "TTS",
  "storyId": 1201,
  "voiceId": "vce_abc123",
  "sentences": [
    {
      "sentenceId": 5001,
      "text": "Mina saw the ocean for the first time.",
      "emotion": "WARM"
    }
  ]
}
```

#### 2단계. ai worker가 command MQ를 consume 해서 처리

1. ai worker는 command queue에서 메시지를 가져옵니다.
2. `jobId`를 기준으로 어떤 작업 결과를 돌려줘야 하는지 추적합니다.
3. 보이스 등록이면 `reference.wav`를 만들고, story TTS면 CosyVoice로 문장별 오디오를 생성합니다.
4. 생성된 파일은 S3에 저장합니다.
5. 내부적으로 결과 payload를 만듭니다.

#### 3단계. ai worker가 result MQ에 결과 이벤트 발행

1. ai worker는 처리 완료 후 `tts.result` exchange에 결과 이벤트를 publish 합니다.
2. 성공이면 `*.succeeded`, 실패면 `*.failed` routing key를 사용합니다.
3. backend는 `backend.tts.result` queue를 consume 하면서 이 이벤트를 받습니다.

result payload 예시:

```json
{
  "jobId": 901,
  "jobType": "TTS",
  "status": "SUCCESS",
  "storyId": 1201,
  "items": [
    {
      "sentenceId": 5001,
      "audioUrl": "https://cdn.example.com/generated/story-tts/1201/sentences/5001.mp3"
    }
  ],
  "fullBookAudioUrl": "https://cdn.example.com/generated/story-tts/1201/full-book/full-book.mp3",
  "errorMessage": null
}
```

#### 4단계. backend가 result MQ를 consume 해서 DB 반영

1. backend result consumer는 `jobId`로 `story_generation_jobs`를 찾습니다.
2. 성공이면 job 상태를 `SUCCESS`로 바꾸고 `result_payload`를 저장합니다.
3. 문장별 결과가 있으면 `scene_sentences.tts_audio_url`을 갱신합니다.
4. 실패면 job 상태를 `FAILED`로 바꾸고 `error_message`를 저장합니다.
5. 이후 프론트는 `GET /api/v1/jobs/{jobId}`로 최종 상태를 조회합니다.

이 구조의 장점:

- backend는 AI 서버의 처리 완료를 HTTP로 기다릴 필요가 없습니다.
- ai worker는 결과를 직접 DB에 붙지 않고 MQ 이벤트만 발행해도 됩니다.
- backend가 최종 DB 반영 책임을 가지므로 서비스 경계가 명확해집니다.

이 구조의 단점:

- command consumer와 result consumer를 둘 다 운영해야 합니다.
- 메시지 중복 소비, 재시도, 멱등성 처리를 더 신경 써야 합니다.
- preview처럼 짧고 즉시 응답 가능한 기능까지 같은 패턴으로 몰아넣으면 복잡도가 올라갑니다.

따라서 현재 범위에서는 아래처럼 나누는 것을 권장합니다.

- `voice register`, `story TTS`
  - command MQ + result MQ 둘 다 사용
- `preview`
  - 1차 구현은 동기 HTTP 처리

즉, 팀원이 말한 방식은 `story TTS` 같은 무거운 작업에는 적절하고, 문서 기준으로도 충분히 채택할 수 있습니다.

---

## 16. 지금 바로 만들 FastAPI API

백엔드 연결은 나중에 붙이더라도, 현재 단계에서는 AI 서버 혼자 실행해서 TTS 로직과 MQ 흐름을 검증할 수 있어야 합니다. 따라서 운영용 인터페이스와 별개로 아래 API를 먼저 만드는 것을 권장합니다.

구분:

- 운영 필수 API
  - 헬스 체크, preview 직접 확인, 개발용 command publish
- 개발/테스트 전용 API
  - job manifest 조회, 로컬 파일 기준 확인

### 16.1 GET `/health`

목적:

- FastAPI 서버 생존 확인
- RabbitMQ 연결 상태, CosyVoice 모델 로드 여부, worker 준비 여부를 간단히 확인

권장 응답 예시:

```json
{
  "success": true,
  "data": {
    "status": "UP",
    "rabbitmq": "UP",
    "cosyvoice": "UP",
    "worker": "UP"
  },
  "message": null
}
```

### 16.2 POST `/internal/dev/tts/preview`

목적:

- RabbitMQ 없이도 `reference.wav + emotion` 조합이 잘 동작하는지 바로 확인
- 가장 먼저 구현해서 CosyVoice 연동 성공 여부를 빠르게 검증

처리 방식:

- 동기 HTTP
- 내부적으로 `CosyVoice /inference_instruct2` 직접 호출
- 결과는 S3 또는 로컬 저장소에 저장 후 URL 반환

요청 예시:

```json
{
  "voiceId": "vce_abc123",
  "text": "잘 자, 우리 아가.",
  "language": "ko-KR",
  "format": "mp3",
  "options": {
    "emotion": "WARM",
    "stylePrompt": "다정한 엄마가 잠자리에서 읽어주듯 읽어줘.",
    "speakingRate": 0.92,
    "pitch": -0.5,
    "volumeGain": 1.0
  }
}
```

응답 예시:

```json
{
  "success": true,
  "data": {
    "voiceId": "vce_abc123",
    "audioUrl": "http://localhost:8000/static/previews/preview_abc123.mp3",
    "appliedStyle": {
      "emotion": "WARM",
      "stylePrompt": "다정한 엄마가 잠자리에서 읽어주듯 읽어줘."
    }
  },
  "message": null
}
```

### 16.3 POST `/internal/dev/commands/voice-clone`

목적:

- backend 없이도 voice register command를 MQ에 넣어 worker 흐름을 검증

처리 방식:

- HTTP 요청을 받으면 `tts.command` exchange에 `voice.register` 메시지를 publish
- 응답은 `{ jobId, status: PENDING }`
- 실제 전처리와 `reference.wav` 생성은 worker가 수행

요청 예시:

```json
{
  "jobId": 1001,
  "voiceId": "vce_abc123",
  "sourceAudioUrl": "file:///C:/tts-test/raw/mom.wav",
  "scriptText": "안녕 해솔아. 오늘은 엄마가 이야기를 읽어줄게.",
  "language": "ko-KR",
  "options": {
    "trimSilence": true,
    "normalizeVolume": true,
    "runNoiseCheck": true
  }
}
```

응답 예시:

```json
{
  "success": true,
  "data": {
    "jobId": 1001,
    "jobType": "VOICE_CLONE",
    "status": "PENDING"
  },
  "message": null
}
```

### 16.4 POST `/internal/dev/commands/story-tts`

목적:

- backend 없이도 story TTS command를 MQ에 넣고 worker가 문장별 오디오를 생성하는지 검증

처리 방식:

- HTTP 요청을 받으면 `tts.command` exchange에 `tts.story` 메시지를 publish
- 응답은 `{ jobId, status: PENDING }`
- 실제 TTS 생성은 worker가 수행

요청 예시:

```json
{
  "jobId": 2001,
  "storyId": 1201,
  "voiceId": "vce_abc123",
  "language": "en-US",
  "format": "mp3",
  "options": {
    "defaultEmotion": "NARRATION",
    "defaultStylePrompt": "부모가 아이에게 읽어주듯 따뜻하고 또렷하게 읽어줘.",
    "generateFullBookAudio": true
  },
  "sentences": [
    {
      "sentenceId": 5001,
      "text": "Mina saw the ocean for the first time.",
      "emotion": "WARM"
    },
    {
      "sentenceId": 5002,
      "text": "\"Wow,\" she whispered.",
      "emotion": "EXCITED"
    }
  ]
}
```

응답 예시:

```json
{
  "success": true,
  "data": {
    "jobId": 2001,
    "jobType": "TTS",
    "status": "PENDING"
  },
  "message": null
}
```

### 16.5 GET `/internal/dev/manifests/{jobId}`

목적:

- backend result consumer가 아직 없어도 worker 처리 결과를 직접 확인

처리 방식:

- worker가 `manifests/jobs/{jobId}/result.json` 또는 동등한 로컬 결과 파일을 남긴다고 가정
- FastAPI는 이 파일을 읽어 현재 상태를 반환

응답 예시:

```json
{
  "success": true,
  "data": {
    "jobId": 2001,
    "jobType": "TTS",
    "status": "SUCCESS",
    "result": {
      "storyId": 1201,
      "items": [
        {
          "sentenceId": 5001,
          "audioUrl": "http://localhost:8000/static/story/1201/5001.mp3"
        }
      ],
      "fullBookAudioUrl": "http://localhost:8000/static/story/1201/full-book.mp3"
    }
  },
  "message": null
}
```

중요:

- `16.3`, `16.4`, `16.5`는 개발/테스트용입니다.
- backend가 붙은 뒤에는 backend가 command/result MQ를 담당하므로 이 API들은 제거하거나 admin/dev 전용으로 내리는 편이 맞습니다.

---

## 17. 문서에만 적는 env 메모

아직 실제 env 파일에는 추가하지 않더라도, 구현하면서 필요할 값은 아래 정도를 예상하면 됩니다.

- `RABBITMQ_URL`
- `RABBITMQ_COMMAND_EXCHANGE`
- `RABBITMQ_RESULT_EXCHANGE`
- `RABBITMQ_VOICE_REGISTER_QUEUE`
- `RABBITMQ_TTS_STORY_QUEUE`
- `RABBITMQ_BACKEND_RESULT_QUEUE`
- `COSYVOICE_MODEL_DIR`
- `COSYVOICE_DEVICE`
- `TTS_STORAGE_ROOT`
- `TTS_MANIFEST_ROOT`
- `TTS_PUBLIC_BASE_URL`
- `TTS_DEFAULT_LANGUAGE`

메모:

- 지금 단계에서는 `tts.md`에만 적어두고, 실제 env 파일 반영은 구현이 어느 정도 정리된 뒤 한 번에 해도 됩니다.
- 특히 queue/exchange 이름은 backend 팀과 최종 합의한 뒤 env로 빼는 편이 안전합니다.

---

## 18. 테스트 방법

현재 단계에서는 `preview 동기 테스트 -> MQ command 테스트 -> 결과 manifest 확인` 순서로 검증하는 것이 가장 빠릅니다.

### 18.1 1차 테스트: preview가 직접 생성되는지 확인

목표:

- CosyVoice 모델 로드 성공
- `voiceId -> reference.wav` 조회 성공
- `emotion -> instruct_text` 변환 성공

절차:

1. FastAPI 서버를 띄웁니다.
2. `reference.wav`가 준비된 voice 하나를 만듭니다.
3. `POST /internal/dev/tts/preview`를 호출합니다.
4. 응답으로 나온 `audioUrl` 파일을 직접 들어봅니다.

성공 기준:

- 음성이 생성된다.
- 부모 목소리 특성이 유지된다.
- 지정한 감정이 어느 정도 반영된다.

### 18.2 2차 테스트: voice clone command MQ 테스트

목표:

- command queue publish 성공
- worker consume 성공
- `reference.wav` 생성 성공

절차:

1. RabbitMQ, FastAPI, worker를 모두 띄웁니다.
2. `POST /internal/dev/commands/voice-clone`를 호출합니다.
3. RabbitMQ UI 또는 worker 로그에서 메시지 consume 여부를 확인합니다.
4. `GET /internal/dev/manifests/{jobId}` 또는 결과 파일로 상태를 확인합니다.

성공 기준:

- job 상태가 `SUCCESS`
- `reference.wav`가 저장됨
- 필요 시 `voice_profiles.tts_voice_url`에 들어갈 값이 준비됨

### 18.3 3차 테스트: story TTS command MQ 테스트

목표:

- 문장 배열 기준 TTS 생성 성공
- 문장별 mp3 생성 성공
- `scene_sentences.tts_audio_url`에 반영 가능한 결과 구조 확인

절차:

1. `POST /internal/dev/commands/story-tts`를 호출합니다.
2. worker가 각 문장을 순회하며 TTS를 생성하는지 로그로 확인합니다.
3. `GET /internal/dev/manifests/{jobId}`를 호출합니다.
4. `items[].audioUrl`, `fullBookAudioUrl`을 확인합니다.

성공 기준:

- 문장 수와 생성 파일 수가 일치함
- 각 파일이 정상 재생됨
- 감정이 문장별로 다르게 들어감

### 18.4 테스트할 때 꼭 볼 포인트

- 같은 `voiceId`를 써도 문장마다 감정이 달라지는지
- `WARM`, `EXCITED`, `NARRATION` 차이가 실제로 들리는지
- 너무 강한 감정에서 화자 유사도가 무너지지 않는지
- worker 재시도 시 같은 job을 중복 반영하지 않는지
- result payload 구조가 backend가 그대로 받아도 될 만큼 단순한지

### 18.5 구현 순서 기준 추천 테스트 루트

1. `GET /health`
2. `POST /internal/dev/tts/preview`
3. `POST /internal/dev/commands/voice-clone`
4. `GET /internal/dev/manifests/{jobId}`
5. `POST /internal/dev/commands/story-tts`
6. `GET /internal/dev/manifests/{jobId}`

이 순서대로 하면 backend 없이도 `모델 연동`, `MQ publish`, `worker 처리`, `결과 저장`까지 전부 검증할 수 있습니다.
