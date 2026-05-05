# TTS 로그 분석

분석 기준: 2026-05-05 10:35:11부터 10:39:53까지 붙여준 CosyVoice `/inference_cross_lingual` 로그.  
로컬 저장소에서 별도 백엔드/AI worker 실행 로그 파일은 확인되지 않았고, 실제 시간 통계는 붙여준 CosyVoice 로그를 기준으로 산출했다. 백엔드와 AI worker 구간은 현재 코드의 로그 포인트를 함께 대조했다.

## 전체 요약

| 항목 | 값 |
| --- | ---: |
| CosyVoice 요청 수 | 37건 |
| 테스트 관측 구간 | 약 282.1초 |
| 생성 음성 총 길이 | 240.04초 |
| 문장당 평균 음성 길이 | 6.49초 |
| CosyVoice `COLLECT` 총합 | 271.25초 |
| CosyVoice `COLLECT` 평균 | 7.33초/문장 |
| CosyVoice `COLLECT` 최소/최대 | 4.12초 / 11.84초 |
| `PREPARE` 평균 | 87.9ms |
| weighted RTF | 1.13 |
| 관측 구간 기준 처리율 | 실시간의 약 0.85배 |

해석하면, 현재 TTS는 문장 단위로 거의 순차 처리되고 있으며 240초 분량의 음성을 만드는 데 약 282초가 걸렸다. `COLLECT` 기준 RTF는 1.13이라서 음성 길이보다 약 13% 느리다.

## 구간별 판단

`REQ`, `TEMP`, `PREPARE`, `INFER:START`, `INFER:DONE`, `COLLECT`, `RESP` 로그가 반복된다.

| 구간 | 관찰 |
| --- | --- |
| multipart DEBUG | 요청 바디 파싱 로그가 매우 많지만, 대부분 같은 밀리초 안에 끝난다. 성능 병목이라기보다 로그 노이즈에 가깝다. |
| `TEMP` | prompt wav 임시 저장은 대체로 1ms 미만이다. |
| `PREPARE` | 평균 87.9ms로 작다. reference wav 복사/준비 비용은 전체에서 미미하다. |
| `INFER:DONE` | `elapsedMs=0.xx`로 찍히지만 실제 생성 시간이 아니다. generator를 만든 시간에 가깝고, 실제 음성 생성은 `COLLECT`에서 소비된다. |
| `COLLECT` | 전체 시간의 대부분이다. 문장별 4.1초에서 11.8초 사이로 실제 TTS 생성 병목이다. |
| `RESP` | 1ms 미만 수준이라 응답 반환 비용은 작다. |

## TensorRT 오류

중간에 다음 오류가 반복된다.

```text
Set dimension [2,80,1028] for tensor x does not satisfy any optimization profiles.
Valid range for profile 0: [2,80,4]..[2,80,1024]

Set dimension [2,80,1044] for tensor x does not satisfy any optimization profiles.
Valid range for profile 0: [2,80,4]..[2,80,1024]
```

현재 TensorRT plan의 max shape가 1024인데, 일부 문장에서 1028, 1044 frame이 들어와 profile 범위를 넘었다. 해당 요청은 최종적으로 `200 OK`와 음성 출력을 냈으므로 즉시 실패하지는 않았지만, TRT 실행 경로에서 오류가 발생하고 fallback 또는 내부 retry가 일어났을 가능성이 있다.

대응 방향:

1. TensorRT plan을 `max_shape=1152` 또는 `1280` 이상으로 다시 빌드한다.
2. 긴 문장은 더 짧게 쪼개서 1024 이하 shape에 머물게 한다.
3. 운영 로그에서 같은 오류가 계속 나오면 성능 측정값을 TRT 정상 경로와 fallback 경로로 분리해야 한다.

## 백엔드/AI Worker 흐름

코드 기준 TTS 전체 흐름은 다음과 같다.

1. 백엔드 `TtsService.publish()`가 `ai.gpu.tts.generate`로 story TTS job을 publish한다.
2. AI worker `tts_consumer.py`가 job을 consume한다.
3. AI worker가 `generate_story_tts_result()`에서 문장별 CosyVoice HTTP 요청을 보낸다.
4. AI worker가 결과 envelope를 publish한다.
5. 백엔드 `TtsResultHandler.handle()`이 결과를 consume하고 `scene_sentences.tts_audio_url`을 반영한다.

현재 코드에 있는 주요 로그 포인트:

| 컴포넌트 | 로그 키 |
| --- | --- |
| Backend publish | `[TTS:REQ:PUBLISH:START]`, `[TTS:REQ:PUBLISH:DONE]` |
| AI worker consume | `[TTS:WORKER:CONSUME]` |
| AI worker publish | `[TTS:WORKER:PUBLISH]` |
| Backend result consume | `[TTS:RES:CONSUME]` |
| Backend result done | `[TTS:RES:HANDLE:DONE]` |
| CosyVoice client | `[COSYVOICE:HTTP]` |
| CosyVoice server | `[COSYVOICE:REQ]`, `[COLLECT]`, `[RESP]` |

붙여준 로그에는 `TTS:REQ`, `TTS:WORKER`, `TTS:RES` 라인이 없어서 MQ 대기 시간, worker 전체 시간, 백엔드 DB 반영 시간은 이번 샘플에서 직접 계산할 수 없다. 현재 샘플에서 확실히 계산 가능한 것은 CosyVoice server 내부 처리 시간이다.

## 현재 병목

가장 큰 병목은 문장별 CosyVoice 생성이다. 37건의 `COLLECT` 합계가 271.25초이고, `PREPARE` 전체 합계는 3.25초뿐이다. 즉 reference wav 준비나 HTTP 응답 반환보다 모델 생성 시간이 지배적이다.

문장별 호출 구조도 총 시간을 키운다. 37문장을 각각 HTTP 요청으로 처리하므로 prompt wav multipart 업로드, 서버 파싱, generator 생성, 응답 반환이 매번 반복된다. 각 반복 비용은 작지만 37회 누적된다.

## 개선 우선순위

1. TensorRT profile 범위를 재빌드한다. 현재 1024 상한을 넘는 케이스가 실제로 발생했다.
2. 백엔드 jobId와 AI worker jobId를 CosyVoice 요청 로그까지 전달한다. 지금 CosyVoice `requestId`만으로는 백엔드 job과 직접 매칭하기 어렵다.
3. AI worker 로그에 문장별 CosyVoice 호출 시작/종료와 sentenceId를 추가한다.
4. story TTS는 batch endpoint 또는 worker 내부 batch 처리로 HTTP 호출 반복을 줄인다.
5. preview TTS와 story TTS worker를 분리한다. story TTS가 긴 작업이라 preview latency를 밀 수 있다.

## 추가로 필요한 로그

end-to-end 시간을 정확히 보려면 같은 job에 대해 아래 라인이 한 번에 필요하다.

```text
[TTS:REQ:PUBLISH:START]
[TTS:REQ:PUBLISH:DONE]
[TTS:WORKER:CONSUME]
[COSYVOICE:HTTP] 또는 CosyVoice server [COLLECT]
[TTS:WORKER:PUBLISH]
[TTS:RES:CONSUME]
[TTS:RES:HANDLE:DONE]
```

이 로그가 있으면 전체 시간을 다음처럼 분해할 수 있다.

| 계산 항목 | 계산 방식 |
| --- | --- |
| Backend publish 시간 | `REQ:PUBLISH:DONE - REQ:PUBLISH:START` |
| MQ 대기 시간 | `WORKER:CONSUME - REQ:PUBLISH:DONE` |
| Worker 처리 시간 | `WORKER:PUBLISH - WORKER:CONSUME` |
| CosyVoice 순수 처리 시간 | `COLLECT elapsedMs` 합계 |
| Worker 부가 비용 | `Worker 처리 시간 - CosyVoice 처리 시간` |
| Backend 결과 반영 시간 | `RES:HANDLE:DONE - RES:CONSUME` |
| End-to-end 시간 | `RES:HANDLE:DONE - REQ:PUBLISH:START` |

