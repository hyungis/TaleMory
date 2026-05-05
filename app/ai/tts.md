# TTS 정리 메모

## 1. 현재 전체 흐름

### Preview

1. 프론트가 `POST /api/voices/{voiceId}/preview`를 호출한다.
2. 백엔드 [VoicePreviewService.kt](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/backend/src/main/kotlin/com/s210/backend/domain/tts/application/VoicePreviewService.kt)가 권한을 확인하고 Redis에 preview job을 만든다.
3. 백엔드 [TtsService.kt](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/backend/src/main/kotlin/com/s210/backend/domain/tts/application/TtsService.kt)가 RabbitMQ `ai.gpu.tts.preview`로 `TtsPreviewJobMessage`를 publish한다.
4. AI worker가 [tts_consumer.py](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/ai/app/consumers/tts_consumer.py)에서 preview 큐를 consume한다.
5. AI가 reference 음성을 찾고 CosyVoice를 호출한 뒤 결과를 저장하고 `GENERATE_TTS_PREVIEW_COMPLETED` 또는 `GENERATE_TTS_PREVIEW_FAILED`를 publish한다.
6. 백엔드는 Redis의 preview 상태를 갱신하고 프론트는 polling으로 결과를 확인한다.

### Story TTS

1. 프론트가 storyboard confirm을 호출한다.
2. 백엔드 [StoryConfirmService.kt](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/backend/src/main/kotlin/com/s210/backend/domain/story/application/StoryConfirmService.kt)가 `Scene`, `SceneSentence`를 생성한다.
3. 백엔드는 문장별로 TTS 캐시를 조회한다.
4. 캐시 miss 문장만 모아서 `StoryTtsJobMessage` 한 건으로 `ai.gpu.tts.generate`에 publish한다.
5. AI worker가 [tts_consumer.py](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/ai/app/consumers/tts_consumer.py)에서 story TTS 큐를 consume한다.
6. AI worker generates and stores sentence-level TTS audio, then publishes the result envelope.
7. 백엔드 [TtsResultHandler.kt](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/backend/src/main/kotlin/com/s210/backend/domain/tts/application/TtsResultHandler.kt)가 `scene_sentences.tts_audio_url`을 문장별로 채우고 job 결과를 저장한다.

중요: 현재 RabbitMQ는 이미 story 단위로 묶여 있다. 느린 부분은 백엔드 publish 횟수가 아니라 AI worker 내부에서 문장마다 CosyVoice를 반복 호출하는 부분이다.

## 2. 현재 reference 음성 처리

AI는 [dev_tts_service.py](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/ai/app/services/dev_tts_service.py)에서 reference 음성을 이렇게 찾는다.

1. `app/ai/.runtime/storage/voices/{voiceId}/reference.wav`가 있으면 재사용
2. 없고 `referenceAudioS3Key`가 있으면 S3 다운로드
3. 없고 `referenceAudioUrl`이 있으면 URL 다운로드
4. 로컬 runtime 경로에 `reference.wav`로 저장

현재 입력 현실:

- 프론트 voice 녹음 업로드 기본 포맷은 `audio/webm`
- 백엔드는 `voice_profiles.audio_url`에 raw S3 key를 저장
- 따라서 prompt 입력이 이미 wav가 아니라면 AI 또는 CosyVoice 쪽에서 포맷 정규화를 흡수해야 한다

## 3. 현재 worker 구조

### 지금 실제로 도는 구조

- dev/local compose는 아직 `python worker.py`만 띄운다
- [worker.py](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/ai/worker.py)는 아래 consumer를 한 번에 등록한다
  - storyboard
  - storyboard image
  - final illustration
  - TTS

### 이 구조가 의미하는 것

- preview TTS, story TTS, storyboard generation, storyboard image generation, final illustration이 같은 worker 프로세스에서 경쟁한다
- RabbitMQ channel QoS는 [client.py](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/ai/app/mq/client.py) 기준 `prefetch_count=1`이다
- 오래 걸리는 작업 하나가 같은 worker의 다음 작업을 지연시킬 수 있다

### 분리 worker 코드 상태

역할별 엔트리포인트 파일은 이미 있다.

- [worker_story.py](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/ai/worker_story.py)
- [worker_image_storyboard.py](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/ai/worker_image_storyboard.py)
- [worker_image_final.py](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/ai/worker_image_final.py)
- [worker_tts.py](/c:/Users/SSAFY/Desktop/talemory/S14P31S210/app/ai/worker_tts.py)

하지만 compose에서 아직 이 파일들을 사용하지 않고 있으므로, 런타임은 여전히 통합 worker 구조다.

## 4. 주요 성능 병목

### 4-1. 통합 worker 경쟁

현재 증상:

- TTS가 이미지/최종삽화 작업과 같은 프로세스와 채널을 공유한다
- preview가 이미지나 final illustration 작업 때문에 밀릴 수 있다
- story TTS도 다른 큐 작업 때문에 대기 시간이 길어질 수 있다

영향:

- 큐 대기 시간 증가
- preview 응답성 불안정

### 4-2. prompt 음성 반복 처리

현재 증상:

- 같은 목소리 reference를 여러 번 다운로드할 수 있다
- 같은 prompt 음성을 CosyVoice에 여러 번 다시 전송할 수 있다
- 같은 speaker conditioning을 여러 번 다시 계산할 수 있다

영향:

- 반복 I/O
- 반복 전처리
- preview와 story 둘 다 불필요한 지연 발생

### 4-3. 문장마다 CosyVoice 호출

현재 증상:

- RabbitMQ는 story 단위로 한 번만 publish하지만, AI는 문장마다 CosyVoice를 한 번씩 호출한다
- story에 문장이 20개면 CosyVoice 호출도 20번이다

영향:

- HTTP 오버헤드 반복
- speaker conditioning 비용 반복
- 긴 story에서 처리량 저하

### 4-4. TTS 서버의 full-buffer 응답

현재 `server1.py` 패턴은 다음과 같다.

1. 업로드를 temp 파일로 저장
2. 필요하면 wav로 변환
3. `cosyvoice.inference_*` 호출
4. `_collect_wav_audio()`에서 결과를 전부 모음
5. 최종 wav 한 번에 응답

영향:

- 스트리밍 이점이 없다
- preview가 전체 음성 생성이 끝날 때까지 기다린다
- 모델의 first-byte latency 개선이 호출자에게 드러나지 않는다

### 4-5. timing 로그 부재

지금은 아래 시간을 분리해서 볼 수 없다.

- MQ 대기 시간
- S3 다운로드 시간
- prompt 포맷 변환 시간
- CosyVoice 추론 시간
- 결과 저장/업로드 시간

즉 최적화가 측정 기반이 아니라 추측 기반이 되기 쉽다.

## 5. 지금 해볼 만한 성능 개선

### 우선순위 A. worker를 도메인별로 분리

첫 단계 추천:

- TTS를 storyboard/image/final illustration과 분리

이유:

- 구현 리스크가 낮다
- 큐 경쟁이 바로 줄어든다
- preview latency가 더 안정적이다

추천 topology:

- `worker_story.py`
- `worker_image_storyboard.py`
- `worker_image_final.py`
- `worker_tts.py`

그 다음 단계:

- preview TTS와 story TTS를 추가로 분리

이유:

- preview는 짧고 지연에 민감하다
- story TTS는 길고 처리량 중심이다

### 우선순위 B. timing 로그와 baseline부터 확보

최소 측정해야 할 지점:

- backend publish 시각
- worker consume 시작 시각
- reference resolve 시작/끝
- prompt 변환 시작/끝
- CosyVoice 요청 시작/끝
- 출력 저장/업로드 시작/끝
- 결과 publish 시각

필요한 baseline:

- preview cold-start 전체 시간
- preview warm-start 전체 시간
- story 문장당 평균 시간
- story 전체 작업 시간
- queue wait time과 실제 inference time의 비율

### 우선순위 C. speaker conditioning 재사용

장기적으로 가장 의미 있는 개선:

- reference 음성을 한 번 정규화하고 등록
- preview와 story에서 speaker cache 또는 `speaker_id`를 재사용

이유:

- prompt 업로드 반복 제거
- speaker 추출 반복 제거
- preview와 story 둘 다 지연 감소

### 우선순위 D. 여러 문장을 한 요청으로 묶는 batch endpoint

story 쪽에서는 speaker 재사용 다음으로 의미가 큰 개선이다.

중요한 구분:

- 현재 backend는 이미 story당 MQ 요청 1건으로 묶고 있다
- 하지만 현재 AI 서버는 문장 여러 개를 한 번에 추론하지 않는다

더 좋은 목표:

- story MQ job은 그대로 유지
- AI 내부에서 같은 reference를 공유하는 여러 문장을 TTS 서버 batch endpoint 한 번으로 보냄

그러면 줄어드는 것:

- HTTP round-trip 반복
- prompt 전처리 반복
- endpoint 오버헤드 반복

## 6. 페이지 단위 묶음은 가능한가

아이디어:

- 문장마다 CosyVoice 요청을 보내지 않고
- 페이지별 문장들을 묶어서
- 페이지 단위로 한 번에 합성

결론부터 말하면 가능은 하지만, **출력 형태를 어떻게 잡을지**가 핵심이다.

### 6-1. 페이지 요청 1건 = 페이지 오디오 1개만 반환

이건 구현은 단순하지만 현재 문장 클릭 UX와는 맞지 않는다.

현재 백엔드 모델은:

- 각 `SceneSentence` row가 자기 `ttsAudioUrl`을 가짐
- 프론트가 특정 문장을 클릭하면 그 문장만 직접 재생할 수 있어야 함

그런데 페이지 묶음 결과가 단순히:

- `page1.wav`

하나만 나오면 현재 sentence-click 흐름은 깨진다. 유지하려면 최소한 아래 중 하나가 필요하다.

1. 페이지 오디오 안의 문장별 timestamp metadata
2. 생성 후 forced alignment 또는 silence-based segmentation
3. 프론트가 문장별 파일 대신 공용 페이지 오디오를 seek 재생

즉 **페이지 오디오 1개만 저장하는 방식은 지금 스키마와 UX에 바로 맞지 않는다.**

### 6-2. 페이지 요청 1건 = 문장별 결과 여러 개 반환

이게 더 현실적인 “페이지 batching” 해석이다.

의미:

- 한 페이지의 모든 문장을 한 요청으로 보냄
- reference는 한 번만 공유
- 응답은
  - 여러 sentence wav를 한 번에 돌려주거나
  - 페이지 wav 1개와 문장 경계를 같이 돌려주고 나중에 분리

이러면 백엔드는 결국 여전히 아래를 가질 수 있다.

- sentence 1 오디오
- sentence 2 오디오
- sentence 3 오디오

즉 **요청은 페이지 단위로 묶되, 저장 결과는 문장 단위로 유지**하는 방식이다.

이 방식은 현재 문장 클릭 재생과 호환된다.

### 6-3. 가장 안전한 권장안

처음부터 저장 단위를 바꾸지 않는다.

추천:

1. `scene_sentences.tts_audio_url`를 계속 최종 출력 계약으로 유지
2. batching은 inference transport 레벨에서만 수행
3. 그래도 최종 산출물은 sentence-level 파일로 저장

이렇게 하면:

- 프론트 문장 클릭 UX 유지
- 백엔드 result handler 개념 거의 유지
- story 처리량 개선 가능

## 7. story와 preview를 같이 볼 때 추천 구조

### 선택지 1. 저장은 문장 단위 유지, 전송만 최적화

추천.

흐름:

1. reference 음성 1회 정규화
2. speaker 등록 또는 cache 재사용
3. preview는 `voiceId + text`
4. story는 `voiceId + pageSentences[]` 또는 `voiceId + storySentences[]`
5. TTS 서버는 batch 처리
6. backend는 문장 단위 URL 저장 유지

장점:

- 현재 스키마와 잘 맞음
- sentence click UX 유지
- 반복 오버헤드 감소

### 선택지 2. 페이지 오디오 + 문장 offset 저장

가능하지만 backend/frontend 계약 수정이 필요하다.

추가로 필요한 것:

- page-level audio URL
- sentence-level `startMs`, `endMs`
- 프론트 audio seek 재생 로직
- offset 저장용 스키마 또는 별도 테이블

장점:

- 저장 파일 수 감소
- 생성 흐름 단순화 가능성

단점:

- 리팩터링 범위 큼
- 현재 문장 클릭 직접 재생 구조와 안 맞음

### 추천 결론

먼저 선택지 1로 간다.

성능 개선을 얻으면서도 현재 동작을 덜 깨뜨린다.

## 8. 무엇부터 개선할지

추천 순서:

1. backend, AI worker, TTS 서버에 timing 로그 추가
2. preview warm/cold와 story 전체 latency baseline 측정
3. compose에서 split worker 실제 배포
4. TTS worker를 non-TTS worker와 분리
5. 필요하면 preview TTS와 story TTS도 분리
6. prompt/reference 음성을 한 번 정규화하고 캐시
7. speaker registration 또는 speaker cache reuse 추가
8. sentence-batch 또는 page-batch TTS endpoint 추가
9. 저장은 sentence-level 유지
10. 그 다음에야 Qwen을 동일 벤치마크로 비교

## 9. 실무 결론

### 이미 사실인 것

- backend는 문장마다 MQ publish 하지 않는다
- story는 이미 MQ 기준으로 story 단위 batch다
- 진짜 반복 비용은 AI sentence loop와 TTS 서버 호출 안에 있다

### 처음부터 하지 말아야 할 것

- 바로 page-only audio 저장으로 뛰지 말 것
- sentence-level 저장을 바로 없애지 말 것

### 먼저 해야 할 것

- worker 분리
- timing 측정
- prompt 처리 반복 감소
- sentence-level 저장은 유지하면서 inference transport를 batch화

## 10. 페이지 batching 질문에 대한 짧은 답

페이지 단위 묶음 가능하냐

- 가능하다. 단, “한 요청에 여러 페이지/문장을 묶는다”는 뜻으로는 충분히 가능하다.

문장 클릭 재생 유지 가능하냐

- 가능하다. 단, batch 요청 결과를 다시 sentence-level 오디오로 저장해야 한다.

페이지 단위 오디오만 저장하고 끝낼 수 있냐

- 지금 구조에서는 어렵다.

그렇게 하려면 문장별 offset metadata와 프론트 seek 재생 모델까지 같이 바뀌어야 한다.

## 11. 내일 바로 쓸 MQ 테스트 JSON

아래 예시는 현재 구조 기준으로 바로 RabbitMQ에 publish해서 확인할 수 있는 테스트 메시지다.

### 11-1. Preview 테스트용 JSON

용도:

- preview latency 확인
- CosyVoice 연결 확인
- reference 음성 접근 확인

exchange:

```text
ai.request
```

routing key:

```text
ai.gpu.tts.preview
```

body:

```json
{
  "jobId": "preview_tts_test_short_001",
  "jobType": "TTS_PREVIEW",
  "voiceId": "42",
  "payload": {
    "text": "안녕, 해솔아.",
    "language": "ko-KR",
    "format": "wav",
    "referenceAudioUrl": null,
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
}
```

짧은 preview라서:

- queue 대기 시간
- reference resolve 시간
- CosyVoice 실제 추론 시간

을 보기 좋다.

### 11-2. Story 테스트용 JSON

용도:

- 문장 여러 개일 때 총 처리 시간 확인
- 문장당 CosyVoice 호출 반복 비용 확인
- page batching 필요성 체감 확인

exchange:

```text
ai.request
```

routing key:

```text
ai.gpu.tts.generate
```

body:

```json
{
  "jobId": "story_tts_perf_test_001",
  "jobType": "TTS",
  "action": "GENERATE",
  "storyId": 101,
  "payload": {
    "storyId": 101,
    "voiceId": "42",
    "referenceAudioUrl": null,
    "referenceAudioS3Key": "stories/voice/42/reference.wav",
    "language": "ko-KR",
    "format": "wav",
    "options": {
      "defaultEmotion": "NEUTRAL",
      "defaultStylePrompt": null,
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
        "text": "해솔이는 아침 햇살이 비치는 창가에 앉아 파란 스케치북을 천천히 펼쳤다.",
        "speakerKey": "narrator",
        "emotion": "NEUTRAL",
        "stylePrompt": null,
        "ssml": null
      },
      {
        "sentenceId": 1002,
        "pageNumber": 1,
        "sentenceOrder": 2,
        "text": "오늘은 바다를 주제로 그림책을 만들기로 한 날이라서 마음이 유난히 두근거렸다.",
        "speakerKey": "narrator",
        "emotion": "WARM",
        "stylePrompt": null,
        "ssml": null
      },
      {
        "sentenceId": 1003,
        "pageNumber": 2,
        "sentenceOrder": 1,
        "text": "연필 끝이 종이 위를 사각사각 지나가자 잔잔한 파도와 둥근 조약돌, 그리고 작은 갈매기 한 마리가 차례로 모습을 드러냈다.",
        "speakerKey": "narrator",
        "emotion": "CALM",
        "stylePrompt": null,
        "ssml": null
      },
      {
        "sentenceId": 1004,
        "pageNumber": 2,
        "sentenceOrder": 2,
        "text": "해솔이는 그림 속 바닷가에 서 있는 아이의 표정이 너무 외로워 보인다고 생각해, 곁에서 함께 웃어 줄 친구를 한 명 더 그려 넣었다.",
        "speakerKey": "narrator",
        "emotion": "SOFT",
        "stylePrompt": null,
        "ssml": null
      },
      {
        "sentenceId": 1005,
        "pageNumber": 3,
        "sentenceOrder": 1,
        "text": "그 순간 창문 밖에서 불어온 바람이 스케치북의 페이지를 훌쩍 넘겼고, 해솔이는 마치 이야기의 다음 장면이 먼저 말을 걸어오는 것 같은 기분을 느꼈다.",
        "speakerKey": "narrator",
        "emotion": "NARRATION",
        "stylePrompt": null,
        "ssml": null
      },
      {
        "sentenceId": 1006,
        "pageNumber": 3,
        "sentenceOrder": 2,
        "text": "새로운 페이지에는 노을빛 바다가 펼쳐져 있었고, 낮게 물든 하늘 아래에서 두 아이가 주운 조개껍데기를 귀에 대고 바다의 소리를 듣고 있었다.",
        "speakerKey": "narrator",
        "emotion": "WARM",
        "stylePrompt": null,
        "ssml": null
      },
      {
        "sentenceId": 1007,
        "pageNumber": 4,
        "sentenceOrder": 1,
        "text": "해솔이는 마지막 장면만큼은 독자가 오래 기억했으면 좋겠다고 생각하며, 고요한 파도 위로 반짝이는 별빛과 두 아이의 작은 뒷모습을 정성스럽게 덧칠했다.",
        "speakerKey": "narrator",
        "emotion": "CALM",
        "stylePrompt": null,
        "ssml": null
      },
      {
        "sentenceId": 1008,
        "pageNumber": 4,
        "sentenceOrder": 2,
        "text": "그리고 페이지 아래쪽에 조심스럽게 이렇게 적었다. 함께 바라본 풍경은 오래도록 마음속에서 반짝인다고.",
        "speakerKey": "narrator",
        "emotion": "SOFT",
        "stylePrompt": null,
        "ssml": null
      }
    ]
  }
}
```

이 story 예시는:

- 페이지 4개
- 문장 8개

조건이라서 지금 구조에서 충분히 병목을 확인하기 좋다.

### 11-3. 테스트할 때 같이 볼 것

preview는 아래를 확인한다.

- AI worker consume 시작 시각
- reference resolve 시간
- CosyVoice 응답 시간
- preview 결과 publish 시각

story는 아래를 확인한다.

- 문장 1개당 평균 처리 시간
- 문장 수 증가에 따른 총 시간 증가폭
- preview와 같은 worker에 있을 때 queue 지연 발생 여부

### 11-4. 다음 단계 실험 포인트

내일 바로 실험할 수 있는 비교는 이 정도다.

1. preview 짧은 텍스트 1문장
2. story 8문장
3. 같은 reference로 다시 한 번 story 8문장
4. worker 분리 전/후 같은 JSON 반복

이렇게 보면:

- 첫 실행과 재실행 차이
- reference 캐시 효과
- worker 분리 효과
- 문장 반복 비용

을 바로 체감할 수 있다.

## 12. 내일 진행 순서

내일은 아래 순서대로 진행하는 것이 가장 효율적이다.

### 12-1. 먼저 확인할 것

1. 로컬 인프라와 앱 컨테이너가 정상 기동하는지 확인
2. CosyVoice 서버가 실제로 응답하는지 확인
3. `worker.py` 기준인지, 분리 worker 기준인지 확인
4. preview/story용 MQ 테스트 JSON을 각각 한 번씩 실행

### 12-2. 첫 번째 목표

목표는 "지금 느린 이유가 어디인지 숫자로 확인"하는 것이다.

우선 해야 할 일:

1. preview JSON 1회 실행
2. story JSON 1회 실행
3. preview JSON 재실행
4. story JSON 재실행

이렇게 최소 4번 돌려서 아래를 비교한다.

- 첫 실행 vs 재실행 차이
- preview 총 소요 시간
- story 총 소요 시간
- 문장 수 대비 story 처리 시간

### 12-3. 내일 바로 추가할 로그

다음 지점에 timing 로그를 넣는 것이 1순위다.

#### AI worker

- preview/story consume 시작 시각
- reference resolve 시작/끝
- CosyVoice 호출 시작/끝
- 결과 저장 시작/끝
- MQ 결과 publish 시각

#### CosyVoice 서버

- 업로드 파일 저장 시작/끝
- 필요 시 wav 변환 시작/끝
- `cosyvoice.inference_*` 호출 시작/끝
- `_collect_wav_audio()` 시작/끝

#### backend

- preview publish 시각
- story publish 시각
- 결과 consume 시각

### 12-4. 내일 판단할 것

로그를 본 뒤 아래 질문에 답하면 된다.

1. 병목이 queue wait 인가
2. 병목이 reference 다운로드/변환인가
3. 병목이 CosyVoice inference 자체인가
4. 병목이 결과 저장인가
5. preview가 story나 이미지 작업 때문에 같이 밀리는가

### 12-5. 그 다음 우선순위

로그를 본 뒤 보통 다음 순서로 결정하면 된다.

1. worker 분리부터 적용할지
2. TTS를 preview/story로 추가 분리할지
3. reference 재사용 구조를 먼저 넣을지
4. batch endpoint를 먼저 만들지
5. `cross_lingual` 외 다른 CosyVoice API를 비교할지

### 12-6. 페이지 단위 batching 관련 결론

내일 논의가 다시 나와도 기준은 이걸 유지하면 된다.

- 요청 단위를 페이지/문장 묶음으로 키우는 것은 가능
- 하지만 저장 결과는 우선 sentence-level 유지가 맞음
- 즉 "batch request + sentence-level output" 방향으로 판단

### 12-7. 내일 나한테 바로 던질 내용

내일 작업을 바로 이어가려면 아래 4개를 같이 주면 된다.

1. preview 테스트 로그
2. story 테스트 로그
3. 현재 worker 실행 방식
   - `worker.py` 하나인지
   - `worker_story.py`, `worker_tts.py` 등 분리 실행인지
4. CosyVoice 서버 로그

### 12-8. 내일 나한테 이렇게 요청하면 됨

아래처럼 말하면 바로 이어서 작업할 수 있다.

```text
tts.md 기준으로 진행하자.
preview/story 테스트 로그는 이거고,
현재 worker는 이 방식으로 돌고 있다.
병목 분석해서 1순위 수정부터 해줘.
```

또는

```text
tts.md 12번 순서대로 하자.
지금 preview/story 실행 결과가 이렇고,
다음으로 timing 로그부터 넣어줘.
```

### 12-9. 내일 최종 목표

내일 한 번에 다 끝내는 목표는 아니다.

내일의 현실적인 목표는:

1. 병목 구간 확정
2. worker 분리 효과 확인
3. batch 또는 speaker reuse 중 무엇이 먼저인지 결정

여기까지 정하면 이후 구현 방향이 거의 확정된다.

## 13. TensorRT 실험 정리

### 13-1. 기존 내용 요약

이 문서는 TTS 처리 흐름, 병목 위치, worker 분리 방향을 정리하기 위한 문서다.

- backend는 미리듣기와 본문 TTS 작업을 MQ로 발행하고, AI worker는 작업을 consume한 뒤 CosyVoice 서버를 호출한다.
- reference audio는 AI worker에서 다운로드한 뒤 CosyVoice API 요청의 multipart 파일로 전달된다.
- CosyVoice 서버 로그의 `[COSYVOICE:REQ]`, `[TEMP]`, `[PREPARE]`, `[COLLECT]`, `[RESP]` 중 실제 합성 시간은 대부분 `[COLLECT]`에 잡힌다.
- `[COSYVOICE:INFER:DONE] elapsedMs=0.xx`는 실제 합성 완료 시간이 아니다. CosyVoice inference가 generator 형태라서 실제 계산은 `_collect_wav_audio()`에서 output을 수집할 때 발생한다.
- 기존 병목은 reference 처리보다 CosyVoice flow/decoder 합성 구간이 훨씬 크다.
- 개선 우선순위는 worker 분리, timing 로그 추가, reference 재사용, batch endpoint 또는 TensorRT 실험 순서로 본다.

### 13-2. 기준 성능

초기 서버 로그 기준으로 `/inference_cross_lingual` 37건을 보면 다음과 같았다.

| 항목 | 값 |
| --- | ---: |
| 요청 수 | 37 |
| 전체 음성 길이 | 212.72초 |
| `PREPARE` 합계 | 7.11초 |
| `COLLECT` 합계 | 518.13초 |
| 요청당 평균 `COLLECT` | 14.00초 |
| weighted RTF | 2.44 |
| first request부터 final response까지 | 약 9분 2초 |

즉 실제 병목은 `COLLECT`이고, 서버 기준 합성 구간만 약 8분 38초 이상이었다.

### 13-3. fp16 및 서버 내 TensorRT 빌드 시도

`--fp16`은 이 환경에서 성능이 나빠졌다. 예시로 6.28초 음성 생성에 `COLLECT elapsedMs=117649.34`, `rtf=18.734`가 나왔다. 따라서 현재 환경에서는 `--fp16`을 쓰지 않는다.

서버를 바로 `--load_trt`로 켜서 TensorRT plan을 만들면 실패했다.

```bash
python server2.py --port 8001 --model_dir "$MODEL_DIR" --load_trt --trt_concurrent 1
```

실패 이유는 AutoModel이 PyTorch 모델을 먼저 GPU에 올린 상태에서 TensorRT builder가 추가 메모리를 요구했기 때문이다. 로그상 GPU 메모리가 이미 약 5.6GB 사용 중인 상태에서 TRT 빌드가 시작되었고, `OutOfMemory` 이후 `build_serialized_network`가 `None`을 반환해 `TypeError: a bytes-like object is required, not 'NoneType'`로 끝났다.

결론은 서버 실행 중 빌드하지 말고, 서버를 끈 상태에서 plan 파일을 따로 만든 뒤 서버에서 그 plan을 로드하는 방식이 맞다.

### 13-4. TensorRT plan 별도 생성 절차

모델 경로를 먼저 지정한다.

```bash
export MODEL_DIR=/home/ssafy/work/CosyVoice/pretrained_models/Fun-CosyVoice3-0.5B
```

plan 생성 스크립트 위치는 다음처럼 둔다.

```bash
cd ~/work/CosyVoice
python build_trt_plan.py
```

`build_trt_plan.py`는 `$MODEL_DIR/flow.decoder.estimator.fp32.onnx`를 읽어서 `$MODEL_DIR/flow.decoder.estimator.fp32.mygpu.plan`을 생성한다.

처음 성공한 설정은 `max_shape=768`이었지만, 실제 요청에서 shape 826이 들어오면서 실패했다.

```text
Set dimension [2,80,826] for tensor x does not satisfy any optimization profiles.
Valid range for profile 0: [2,80,4]..[2,80,768].
```

따라서 현재 권장 설정은 `opt=768`, `max=1024`다. 긴 문장이 들어와도 1024까지는 처리하고, 자주 나오는 700~900대 shape에 맞춰 최적화하기 위해서다.

```python
min_shape = [(2, 80, 4), (2, 1, 4), (2, 80, 4), (2, 80, 4)]
opt_shape = [(2, 80, 768), (2, 1, 768), (2, 80, 768), (2, 80, 768)]
max_shape = [(2, 80, 1024), (2, 1, 1024), (2, 80, 1024), (2, 80, 1024)]
input_names = ["x", "mask", "mu", "cond"]
```

중요한 점은 `build_trt_plan.py`와 CosyVoice 런타임의 `get_trt_kwargs()`가 같은 shape 범위를 써야 한다는 것이다.

수정 대상:

```bash
~/work/CosyVoice/build_trt_plan.py
~/work/CosyVoice/cosyvoice/cli/model.py
```

수정 위치를 찾는 명령어는 다음과 같다.

```bash
grep -n "def get_trt_kwargs" -A12 ~/work/CosyVoice/cosyvoice/cli/model.py
grep -n "set_memory_pool_limit\|opt_shape\|max_shape" -A8 ~/work/CosyVoice/build_trt_plan.py
```

`build_trt_plan.py`가 없으면 `~/work/CosyVoice/build_trt_plan.py`로 새로 만든다. 핵심은 ONNX 입력, plan 출력, profile shape, workspace를 명확히 지정하는 것이다.

```python
import os
import tensorrt as trt

model_dir = os.environ["MODEL_DIR"]
onnx_path = f"{model_dir}/flow.decoder.estimator.fp32.onnx"
plan_path = f"{model_dir}/flow.decoder.estimator.fp32.mygpu.plan"

logger = trt.Logger(trt.Logger.INFO)
builder = trt.Builder(logger)
network = builder.create_network(1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
parser = trt.OnnxParser(network, logger)

with open(onnx_path, "rb") as f:
    if not parser.parse(f.read()):
        for i in range(parser.num_errors):
            print(parser.get_error(i))
        raise RuntimeError("failed to parse onnx")

config = builder.create_builder_config()
config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 1 << 30)  # 1GB

profile = builder.create_optimization_profile()
input_names = ["x", "mask", "mu", "cond"]
min_shape = [(2, 80, 4), (2, 1, 4), (2, 80, 4), (2, 80, 4)]
opt_shape = [(2, 80, 768), (2, 1, 768), (2, 80, 768), (2, 80, 768)]
max_shape = [(2, 80, 1024), (2, 1, 1024), (2, 80, 1024), (2, 80, 1024)]

for name, min_s, opt_s, max_s in zip(input_names, min_shape, opt_shape, max_shape):
    profile.set_shape(name, min_s, opt_s, max_s)

config.add_optimization_profile(profile)
engine_bytes = builder.build_serialized_network(network, config)
if engine_bytes is None:
    raise RuntimeError("TensorRT build failed")

with open(plan_path, "wb") as f:
    f.write(engine_bytes)

print(f"saved: {plan_path}")
```

`model.py`에서는 다음 함수 안의 shape를 동일하게 맞춘다.

```python
def get_trt_kwargs(self):
    min_shape = [(2, 80, 4), (2, 1, 4), (2, 80, 4), (2, 80, 4)]
    opt_shape = [(2, 80, 768), (2, 1, 768), (2, 80, 768), (2, 80, 768)]
    max_shape = [(2, 80, 1024), (2, 1, 1024), (2, 80, 1024), (2, 80, 1024)]
    input_names = ["x", "mask", "mu", "cond"]
    return {
        "min_shape": min_shape,
        "opt_shape": opt_shape,
        "max_shape": max_shape,
        "input_names": input_names,
    }
```

### 13-5. 빌드 및 실행 명령어

기존 plan을 백업한다.

```bash
cp "$MODEL_DIR"/flow.decoder.estimator.fp32.mygpu.plan \
   "$MODEL_DIR"/flow.decoder.estimator.fp32.mygpu.plan.opt512.bak
```

기존 plan을 지우고 새로 만든다.

```bash
rm -f "$MODEL_DIR"/flow.decoder.estimator.fp32.mygpu.plan
cd ~/work/CosyVoice
python build_trt_plan.py
ls -lh "$MODEL_DIR"/flow.decoder.estimator.fp32.mygpu.plan
```

서버 실행은 다음처럼 한다. `--fp16`은 붙이지 않는다.

```bash
cd ~/work/CosyVoice/runtime/python/fastapi
python server2.py --port 8001 --model_dir "$MODEL_DIR" --load_trt --trt_concurrent 1
```

문제가 생기면 백업 plan으로 되돌린다.

```bash
cp "$MODEL_DIR"/flow.decoder.estimator.fp32.mygpu.plan.opt512.bak \
   "$MODEL_DIR"/flow.decoder.estimator.fp32.mygpu.plan
```

기본 서버 실행에는 영향이 없다. `--load_trt`를 붙이지 않고 실행하면 기존 PyTorch 경로로 돈다.

```bash
python server2.py --port 8001 --model_dir "$MODEL_DIR"
```

### 13-6. 최종 실측 결과

Docker 컨테이너 로그 기준으로 story TTS worker는 정상 완료했다.

```text
[TTS:WORKER:CONSUME] jobId=39 storyId=8 voiceId=13 sentenceCount=34
[TTS:STORY:GENERATE:DONE] storyId=8 voiceId=13 sentenceCount=34 elapsedMs=243599
[TTS:WORKER:PUBLISH] jobId=39 storyId=8 elapsedMs=243603
```

backend도 결과를 정상 consume했고 DB 반영까지 끝났다.

```text
TTS job 39 SUCCESS - storyId=8, applied=34/34
```

worker 로그에서 계산한 결과는 다음과 같다.

| 항목 | 값 |
| --- | ---: |
| 문장 수 | 34 |
| 전체 worker 처리 시간 | 243.60초 |
| CosyVoice HTTP 합계 | 237.08초 |
| 요청당 CosyVoice 평균 | 6.97초 |
| 요청당 CosyVoice 최소 | 4.05초 |
| 요청당 CosyVoice 최대 | 9.80초 |
| 전체 음성 길이 | 198.80초 |
| weighted RTF | 1.19 |

초기 기준과 비교하면 다음 정도 개선이다.

| 항목 | 기존 | TRT 적용 후 | 개선 |
| --- | ---: | ---: | ---: |
| 요청당 평균 합성 시간 | 약 14.00초 | 약 6.97초 | 약 50% 감소 |
| weighted RTF | 약 2.44 | 약 1.19 | 약 51% 감소 |
| 전체 story 처리 | 약 8분 45초 수준 | 약 4분 04초 | 약 2배 빨라짐 |

### 13-7. 추가 판단

TensorRT workspace를 늘리면 builder가 더 많은 tactic을 검토할 수 있어서 plan 품질이 좋아질 가능성은 있다. 하지만 무조건 빨라지는 것은 아니고, RTX 4050 Laptop GPU에서는 너무 크게 잡으면 다시 OOM이 난다. 현실적인 실험 범위는 1GB에서 2GB 정도다.

`max_shape`를 크게 잡는 것도 무조건 빠르게 만들지 않는다. `max_shape`는 처리 가능한 최대 길이를 늘리는 값이고, 속도는 주로 실제 입력이 `opt_shape`에 얼마나 가까운지에 영향을 받는다. 현재 로그에서 700~900대 shape가 나왔으므로 `opt=768`, `max=1024`가 합리적인 시작점이다.

`--trt_concurrent`를 늘린다고 현재 story 처리 시간이 바로 줄어들 가능성은 낮다. 지금 worker가 문장을 순차적으로 CosyVoice에 보내는 구조라면 TRT context가 여러 개 있어도 동시에 쓸 일이 별로 없다. 병렬 요청 구조를 만들기 전에는 `--trt_concurrent 1`이 가장 안전하다.

페이지에서 `Unexpected worker error`가 떴던 원인은 서버 실패가 아니라 AI worker timeout일 가능성이 높다. CosyVoice 서버는 200 OK를 반환했지만 한 요청이 60초를 넘었고, AI worker 기본 timeout이 60초였다. 느린 요청을 허용하려면 worker 환경 변수에 다음 값을 둔다.

```bash
COSYVOICE_TIMEOUT_SEC=180
```

TRT 적용 후에는 요청당 시간이 10초 안팎으로 줄었기 때문에 timeout 문제는 크게 줄어든다.
