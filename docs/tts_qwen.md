# Qwen3-TTS 로컬 서버 전환 메모

## 목표

기존 TTS 흐름은 다음과 같다.

```text
Frontend -> Backend -> RabbitMQ -> AI TTS worker -> CosyVoice server -> storage -> RabbitMQ result -> Backend
```

Qwen 전환 목표는 Backend, Frontend, MQ 계약을 유지하고 AI TTS worker 내부 엔진만 교체하는 것이다.

```text
Frontend -> Backend -> RabbitMQ -> AI TTS worker -> Qwen3-TTS server -> storage -> RabbitMQ result -> Backend
```

## 왜 DB/프론트/백엔드를 크게 안 바꿔도 되는가

Backend가 MQ로 보내는 TTS payload는 이미 엔진 독립적이다.

```text
voiceId
referenceAudioUrl / referenceAudioS3Key
language
format
options
sentences[]
```

AI worker는 엔진에서 받은 audio bytes를 기존 응답 형태로 변환해 MQ에 publish한다.

```text
items[]
sceneSentenceUpdates[]
usage
```

Backend는 `sceneSentenceUpdates[].ttsAudioUrl`을 DB에 저장하고 Frontend는 해당 URL을 재생한다. 따라서 Qwen 서버는 S3나 DB를 알 필요가 없다.

단, Qwen3 Base 모델은 reference transcript(`ref_text`)가 있으면 품질이 더 안정적이다. 현재 1차 PoC는 `x_vector_only_mode=true`로 reference text 없이 진행한다. 품질이 부족하면 나중에 `voice_profiles` 쪽에 transcript 컬럼/API를 추가한다.

## WSL Qwen 서버 준비

WSL에서 GPU 확인:

```bash
nvidia-smi
```

Conda 환경:

```bash
conda create -n qwen3-tts python=3.12 -y
conda activate qwen3-tts
conda install -y pip setuptools wheel
python -m pip install -U pip setuptools wheel
```

Qwen repo에서 editable install:

```bash
cd ~/work/Qwen3-TTS
pip install -e .
pip install fastapi uvicorn python-multipart
```

SoX는 conda env가 아니라 WSL Ubuntu 시스템에 설치한다.

```bash
sudo apt update
sudo apt install -y sox libsox-dev libsox-fmt-all
```

모델 캐시 위치:

```bash
mkdir -p ~/models/huggingface
export HF_HOME=~/models/huggingface
echo 'export HF_HOME=~/models/huggingface' >> ~/.bashrc
```

## Qwen 서버 코드

서버 파일 예: `~/work/Qwen3-TTS/qwen_tts_server.py`

```python
from __future__ import annotations

import base64
import json
import logging
import tempfile
import uuid
from io import BytesIO
from pathlib import Path
from time import perf_counter
from typing import Any

import soundfile as sf
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from qwen_tts import Qwen3TTSModel

MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("qwen_tts_server")

app = FastAPI(title="Qwen3 TTS Server")

model: Qwen3TTSModel | None = None


def elapsed_ms(started: float) -> int:
    return int((perf_counter() - started) * 1000)


@app.on_event("startup")
def load_model() -> None:
    global model
    started = perf_counter()

    logger.info("[QWEN:STARTUP:BEGIN] model=%s", MODEL_ID)
    model = Qwen3TTSModel.from_pretrained(
        MODEL_ID,
        device_map="cuda:0",
        dtype=torch.bfloat16,
    )
    logger.info(
        "[QWEN:STARTUP:DONE] model=%s cuda=%s gpu=%s elapsedMs=%d",
        MODEL_ID,
        torch.cuda.is_available(),
        torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        elapsed_ms(started),
    )


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "model": MODEL_ID,
        "cuda": torch.cuda.is_available(),
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
    }


@app.post("/tts/voice-clone")
async def voice_clone(
    ref_audio: UploadFile = File(...),
    texts_json: str = Form(...),
    language: str = Form("Korean"),
    ref_text: str = Form(""),
    x_vector_only_mode: bool = Form(True),
) -> dict[str, Any]:
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")

    request_id = uuid.uuid4().hex[:12]
    request_started = perf_counter()

    try:
        texts = json.loads(texts_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="texts_json must be a JSON string/list") from exc

    if isinstance(texts, str):
        texts = [texts]
    if not isinstance(texts, list) or not texts:
        raise HTTPException(status_code=400, detail="texts_json must be a non-empty list")
    if not all(isinstance(text, str) and text.strip() for text in texts):
        raise HTTPException(status_code=400, detail="texts_json must contain non-empty strings")

    text_lens = [len(text) for text in texts]
    total_text_len = sum(text_lens)

    logger.info(
        "[QWEN:REQ:BEGIN] requestId=%s count=%d language=%s xVectorOnly=%s totalTextLen=%d textLens=%s refFile=%s",
        request_id,
        len(texts),
        language,
        x_vector_only_mode,
        total_text_len,
        text_lens,
        ref_audio.filename,
    )

    suffix = Path(ref_audio.filename or "reference.wav").suffix or ".wav"
    ref_started = perf_counter()

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as temp:
        ref_bytes = await ref_audio.read()
        temp.write(ref_bytes)
        temp.flush()

        logger.info(
            "[QWEN:REF:READY] requestId=%s refBytes=%d elapsedMs=%d",
            request_id,
            len(ref_bytes),
            elapsed_ms(ref_started),
        )

        prompt_started = perf_counter()
        prompt = model.create_voice_clone_prompt(
            ref_audio=temp.name,
            ref_text=ref_text,
            x_vector_only_mode=x_vector_only_mode,
        )
        prompt_ms = elapsed_ms(prompt_started)

        logger.info(
            "[QWEN:PROMPT:DONE] requestId=%s refTextLen=%d promptMs=%d",
            request_id,
            len(ref_text),
            prompt_ms,
        )

        infer_started = perf_counter()
        wavs, sr = model.generate_voice_clone(
            text=texts,
            language=[language] * len(texts),
            voice_clone_prompt=prompt,
        )
        infer_ms = elapsed_ms(infer_started)

    logger.info(
        "[QWEN:INFER:DONE] requestId=%s count=%d sampleRate=%s inferMs=%d avgInferMs=%.2f",
        request_id,
        len(wavs),
        sr,
        infer_ms,
        infer_ms / max(len(wavs), 1),
    )

    audios = []
    encode_total_started = perf_counter()

    for idx, wav in enumerate(wavs):
        item_started = perf_counter()
        buffer = BytesIO()
        sf.write(buffer, wav, sr, format="WAV")
        audio_bytes = buffer.getvalue()

        duration_ms = int((len(wav) / sr) * 1000) if sr else None
        encode_ms = elapsed_ms(item_started)

        logger.info(
            "[QWEN:ITEM] requestId=%s index=%d textLen=%d durationMs=%s audioBytes=%d encodeMs=%d",
            request_id,
            idx,
            text_lens[idx] if idx < len(text_lens) else None,
            duration_ms,
            len(audio_bytes),
            encode_ms,
        )

        audios.append(
            {
                "index": idx,
                "format": "wav",
                "sampleRate": sr,
                "durationMs": duration_ms,
                "audioBytes": len(audio_bytes),
                "audioBase64": base64.b64encode(audio_bytes).decode("ascii"),
            }
        )

    encode_total_ms = elapsed_ms(encode_total_started)
    total_ms = elapsed_ms(request_started)

    logger.info(
        "[QWEN:REQ:DONE] requestId=%s count=%d promptMs=%d inferMs=%d encodeMs=%d totalMs=%d",
        request_id,
        len(audios),
        prompt_ms,
        infer_ms,
        encode_total_ms,
        total_ms,
    )

    return {
        "requestId": request_id,
        "model": MODEL_ID,
        "language": language,
        "count": len(audios),
        "timing": {
            "promptMs": prompt_ms,
            "inferMs": infer_ms,
            "encodeMs": encode_total_ms,
            "totalMs": total_ms,
        },
        "audios": audios,
    }
```

서버 실행:

```bash
uvicorn qwen_tts_server:app --host 0.0.0.0 --port 8091
```

상태 확인:

```bash
curl http://localhost:8091/health
```

## AI worker 변경 요약

추가/수정한 파일:

```text
app/ai/app/core/config.py
app/ai/app/services/qwen_server_client.py
app/ai/app/services/dev_tts_service.py
app/ai/app/consumers/tts_consumer.py
app/ai/app/api/routes/tts.py
infra/env/app.local.env.example
```

동작:

```text
TTS_ENGINE=cosyvoice -> 기존 CosyVoice 호출
TTS_ENGINE=qwen      -> Qwen FastAPI 서버 호출
```

Qwen 서버 응답은 최종 Backend 응답이 아니다. AI worker가 `audioBase64`를 디코딩하고 기존 `store_bytes(...)`로 저장한 뒤 기존 MQ result 형태로 변환한다.

## env 설정

`infra/env/app.local.env`에 설정한다.

```env
TTS_ENGINE=qwen
QWEN_TTS_SERVER_URL=http://host.docker.internal:8091
QWEN_TTS_VOICE_CLONE_PATH=/tts/voice-clone
QWEN_TTS_TIMEOUT_SEC=300
QWEN_TTS_X_VECTOR_ONLY_MODE=true
```

Docker worker에서 `localhost:8091`은 컨테이너 자기 자신이다. 로컬 Docker Desktop에서 WSL/호스트 Qwen 서버로 붙을 때는 보통 다음을 쓴다.

```env
QWEN_TTS_SERVER_URL=http://host.docker.internal:8091
```

WSL에 Tailscale을 직접 붙였으면 다음처럼 쓴다.

```env
QWEN_TTS_SERVER_URL=http://<WSL_TAILSCALE_IP>:8091
```

## storage 설정

Qwen 서버는 S3를 알 필요 없다. AI worker가 저장 책임을 가진다.

로컬 저장:

```env
TTS_STORAGE_MODE=local
TTS_PUBLIC_BASE_URL=/static
```

S3 업로드:

```env
TTS_STORAGE_MODE=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=s210-iportfolio-dev
AWS_S3_ENV_PREFIX=local
AWS_S3_PREFIX=stories/tts
AWS_S3_PUBLIC_BASE_URL=
```

현재 `storage_service.py`는 S3 모드에서도 먼저 로컬 파일을 쓰고 S3에 업로드한다. 업로드 후 로컬 파일 삭제는 하지 않는다.

## compose

로컬 Docker Desktop이면 보통 compose 수정 없이 `host.docker.internal`이 된다.

Linux EC2 Docker에서 host gateway가 필요하면 TTS worker 서비스에 추가한다.

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

대상:

```text
ai-tts-preview-worker
ai-tts-story-worker
```

env 변경 후 worker 재기동:

```powershell
docker compose -f infra/compose/docker-compose.app-local.yml up -d --build ai-tts-preview-worker ai-tts-story-worker
```

로그 확인:

```powershell
docker compose -f infra/compose/docker-compose.app-local.yml logs -f ai-tts-preview-worker ai-tts-story-worker
```

## 로그 해석

Qwen 서버:

```text
[QWEN:STARTUP:DONE] 모델 로딩 완료
[QWEN:REQ:BEGIN] 요청 시작, 문장 수/글자 수
[QWEN:REF:READY] reference audio 수신 완료
[QWEN:PROMPT:DONE] reference prompt 생성 시간
[QWEN:INFER:DONE] batch 전체 추론 시간
[QWEN:ITEM] 문장별 결과 오디오 길이/bytes/wav 인코딩 시간
[QWEN:REQ:DONE] 전체 요청 시간
```

AI worker:

```text
[QWEN_TTS:HTTP] Qwen 서버 HTTP 왕복 시간
[TTS_PREVIEW:ENGINE] preview 엔진 처리 시간
[TTS:STORY:SENTENCE] 문장별 저장 시간과 audio bytes
[TTS:STORY:GENERATE:DONE] story TTS 전체 시간
```

주의: batch 방식에서는 `[QWEN:ITEM] encodeMs`가 문장별 모델 추론 시간이 아니라 wav 인코딩 시간이다. 문장별 모델 추론 시간을 정확히 재려면 Qwen 서버에서 batch 대신 문장별 `generate_voice_clone(...)` loop를 따로 추가해야 한다.

## 검증 순서

1. Qwen 서버 단독 확인

```bash
curl http://localhost:8091/health
```

2. Qwen 서버 직접 요청 테스트

```bash
python - <<'PY'
import base64
import json
import requests

files = {"ref_audio": open("reference.wav", "rb")}
data = {
    "texts_json": json.dumps(["안녕하세요. 첫 번째 문장입니다."], ensure_ascii=False),
    "language": "Korean",
    "ref_text": "",
    "x_vector_only_mode": "true",
}

res = requests.post("http://localhost:8091/tts/voice-clone", files=files, data=data, timeout=300)
res.raise_for_status()
payload = res.json()

for audio in payload["audios"]:
    path = f"server_test_{audio['index']}.wav"
    with open(path, "wb") as f:
        f.write(base64.b64decode(audio["audioBase64"]))
    print("saved", path)
PY
```

3. AI preview worker 확인

```powershell
docker compose -f infra/compose/docker-compose.app-local.yml logs -f ai-tts-preview-worker
```

4. Frontend에서 미리듣기 실행

5. Story confirm/TTS 실행 후 story worker 로그 확인

```powershell
docker compose -f infra/compose/docker-compose.app-local.yml logs -f ai-tts-story-worker
```

## 남은 주의점

- `QWEN_TTS_X_VECTOR_ONLY_MODE=true`는 DB 변경 없이 갈 수 있지만 품질이 떨어질 수 있다.
- 품질 개선이 필요하면 reference audio transcript를 저장하고 `ref_text`로 전달해야 한다.
- Qwen 서버와 AI worker를 다른 머신에 두면 네트워크 왕복과 port proxy가 병목이 될 수 있다.
- 운영에서는 AI worker와 Qwen 서버를 같은 EC2 또는 같은 내부망/VPC에 두는 것이 좋다.
