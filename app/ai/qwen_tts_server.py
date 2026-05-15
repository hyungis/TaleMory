from __future__ import annotations

import base64
import json
import logging
import subprocess
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

CHUNK_SIZE = 8
MAX_NEW_TOKENS = 800

MAX_AUDIO_DURATION_MS = 15000
MAX_ITEM_RETRIES = 1
RETRY_MAX_NEW_TOKENS = 800

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("qwen_tts_server")

app = FastAPI(title="Qwen3 TTS Server")

model: Qwen3TTSModel | None = None


def elapsed_ms(started: float) -> int:
    return int((perf_counter() - started) * 1000)


def log_cuda_memory(request_id: str, label: str) -> None:
    if not torch.cuda.is_available():
        return

    logger.info(
        "[CUDA:%s] requestId=%s allocatedMB=%.1f reservedMB=%.1f maxAllocatedMB=%.1f",
        label,
        request_id,
        torch.cuda.memory_allocated() / 1024 / 1024,
        torch.cuda.memory_reserved() / 1024 / 1024,
        torch.cuda.max_memory_allocated() / 1024 / 1024,
    )


def convert_reference_to_wav(input_path: str, output_path: str) -> None:
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                input_path,
                "-ac",
                "1",
                "-ar",
                "24000",
                "-sample_fmt",
                "s16",
                output_path,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail="ffmpeg is not installed") from exc
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.decode("utf-8", errors="ignore").strip()
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode reference audio with ffmpeg: {detail[-500:]}",
        ) from exc


def get_wav_duration_ms(wav_path: str) -> int:
    try:
        info = sf.info(wav_path)
        return int((info.frames / info.samplerate) * 1000)
    except Exception:
        return -1


def get_wav_array_duration_ms(wav: Any, sample_rate: int | None) -> int | None:
    if sample_rate is None:
        return None
    return int((len(wav) / sample_rate) * 1000)


def is_abnormal_audio_duration(duration_ms: int | None) -> bool:
    return duration_ms is not None and duration_ms > MAX_AUDIO_DURATION_MS


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
        "chunkSize": CHUNK_SIZE,
        "maxNewTokens": MAX_NEW_TOKENS,
        "maxAudioDurationMs": MAX_AUDIO_DURATION_MS,
    }


@app.post("/tts/voice-clone")
async def voice_clone(
    ref_audio: UploadFile = File(...),
    texts_json: str = Form(...),
    language: str = Form("Korean"),
    ref_text: str = Form(""),
    x_vector_only_mode: bool = Form(True),
    response_format: str = Form("wav"),
) -> dict[str, Any]:
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")

    request_id = uuid.uuid4().hex[:12]
    request_started = perf_counter()

    prompt_ms = 0
    infer_ms = 0
    encode_total_ms = 0

    try:
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

        texts = [text.strip() for text in texts]

        response_format = response_format.lower().strip()

        if response_format != "wav":
            logger.info(
                "[QWEN:FORMAT:FALLBACK] requestId=%s requested=%s resolved=wav",
                request_id,
                response_format,
            )
            response_format = "wav"

        text_lens = [len(text) for text in texts]
        total_text_len = sum(text_lens)

        logger.info(
            "[QWEN:REQ:BEGIN] requestId=%s count=%d language=%s xVectorOnly=%s totalTextLen=%d textLens=%s refFile=%s refContentType=%s chunkSize=%d maxNewTokens=%d maxAudioDurationMs=%d",
            request_id,
            len(texts),
            language,
            x_vector_only_mode,
            total_text_len,
            text_lens,
            ref_audio.filename,
            ref_audio.content_type,
            CHUNK_SIZE,
            MAX_NEW_TOKENS,
            MAX_AUDIO_DURATION_MS,
        )

        log_cuda_memory(request_id, "REQ_BEGIN")

        original_suffix = Path(ref_audio.filename or "reference").suffix or ".audio"
        ref_started = perf_counter()

        with tempfile.NamedTemporaryFile(suffix=original_suffix, delete=True) as source_temp:
            ref_bytes = await ref_audio.read()

            if not ref_bytes:
                raise HTTPException(status_code=400, detail="ref_audio must not be empty")

            source_temp.write(ref_bytes)
            source_temp.flush()

            logger.info(
                "[QWEN:REF:READY] requestId=%s refBytes=%d elapsedMs=%d",
                request_id,
                len(ref_bytes),
                elapsed_ms(ref_started),
            )

            convert_started = perf_counter()

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as wav_temp:
                convert_reference_to_wav(source_temp.name, wav_temp.name)

                ref_wav_bytes = Path(wav_temp.name).stat().st_size
                ref_duration_ms = get_wav_duration_ms(wav_temp.name)

                logger.info(
                    "[QWEN:REF:WAV] requestId=%s wavBytes=%d durationMs=%d elapsedMs=%d",
                    request_id,
                    ref_wav_bytes,
                    ref_duration_ms,
                    elapsed_ms(convert_started),
                )

                if ref_duration_ms > 15000:
                    logger.warning(
                        "[QWEN:REF:LONG] requestId=%s durationMs=%d recommendedMs=3000~15000",
                        request_id,
                        ref_duration_ms,
                    )

                prompt_started = perf_counter()

                prompt = model.create_voice_clone_prompt(
                    ref_audio=wav_temp.name,
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
                wavs = []
                sr = None
                chunk_timings = []

                for chunk_start in range(0, len(texts), CHUNK_SIZE):
                    chunk = texts[chunk_start : chunk_start + CHUNK_SIZE]
                    chunk_index = chunk_start // CHUNK_SIZE + 1
                    chunk_total = (len(texts) + CHUNK_SIZE - 1) // CHUNK_SIZE
                    chunk_started = perf_counter()

                    logger.info(
                        "[QWEN:CHUNK:BEGIN] requestId=%s chunk=%d/%d start=%d count=%d totalTextLen=%d textLens=%s texts=%s",
                        request_id,
                        chunk_index,
                        chunk_total,
                        chunk_start,
                        len(chunk),
                        sum(len(text) for text in chunk),
                        [len(text) for text in chunk],
                        chunk,
                    )

                    log_cuda_memory(request_id, f"CHUNK_{chunk_index}_BEFORE")

                    try:
                        chunk_wavs, chunk_sr = model.generate_voice_clone(
                            text=chunk,
                            language=[language] * len(chunk),
                            voice_clone_prompt=prompt,
                            max_new_tokens=MAX_NEW_TOKENS,
                        )
                    except Exception:
                        logger.exception(
                            "[QWEN:CHUNK:ERROR] requestId=%s chunk=%d/%d start=%d count=%d",
                            request_id,
                            chunk_index,
                            chunk_total,
                            chunk_start,
                            len(chunk),
                        )
                        raise HTTPException(
                            status_code=500,
                            detail=f"Qwen generation failed at chunk {chunk_index}/{chunk_total}",
                        )

                    if len(chunk_wavs) != len(chunk):
                        logger.error(
                            "[QWEN:CHUNK:COUNT_MISMATCH] requestId=%s chunk=%d/%d expected=%d actual=%d",
                            request_id,
                            chunk_index,
                            chunk_total,
                            len(chunk),
                            len(chunk_wavs),
                        )
                        raise HTTPException(
                            status_code=502,
                            detail=f"Qwen returned wrong audio count at chunk {chunk_index}/{chunk_total}",
                        )

                    for local_idx, chunk_wav in enumerate(chunk_wavs):
                        global_idx = chunk_start + local_idx
                        duration_ms = get_wav_array_duration_ms(chunk_wav, chunk_sr)

                        if not is_abnormal_audio_duration(duration_ms):
                            continue

                        bad_text = chunk[local_idx]

                        logger.warning(
                            "[QWEN:ITEM:ABNORMAL] requestId=%s chunk=%d/%d globalIndex=%d localIndex=%d durationMs=%s maxDurationMs=%d text=%r",
                            request_id,
                            chunk_index,
                            chunk_total,
                            global_idx,
                            local_idx,
                            duration_ms,
                            MAX_AUDIO_DURATION_MS,
                            bad_text,
                        )

                        retry_wav = None
                        retry_sr = None
                        retry_duration_ms = None

                        for retry_attempt in range(1, MAX_ITEM_RETRIES + 1):
                            retry_started = perf_counter()

                            try:
                                retry_wavs, retry_sr = model.generate_voice_clone(
                                    text=[bad_text],
                                    language=[language],
                                    voice_clone_prompt=prompt,
                                    max_new_tokens=RETRY_MAX_NEW_TOKENS,
                                )
                            except Exception:
                                logger.exception(
                                    "[QWEN:ITEM:RETRY:ERROR] requestId=%s globalIndex=%d attempt=%d text=%r",
                                    request_id,
                                    global_idx,
                                    retry_attempt,
                                    bad_text,
                                )
                                continue

                            if not retry_wavs:
                                logger.error(
                                    "[QWEN:ITEM:RETRY:EMPTY] requestId=%s globalIndex=%d attempt=%d text=%r",
                                    request_id,
                                    global_idx,
                                    retry_attempt,
                                    bad_text,
                                )
                                continue

                            if retry_sr != chunk_sr:
                                logger.error(
                                    "[QWEN:ITEM:RETRY:SR_MISMATCH] requestId=%s globalIndex=%d attempt=%d chunkSr=%s retrySr=%s text=%r",
                                    request_id,
                                    global_idx,
                                    retry_attempt,
                                    chunk_sr,
                                    retry_sr,
                                    bad_text,
                                )
                                continue

                            retry_duration_ms = get_wav_array_duration_ms(retry_wavs[0], retry_sr)

                            logger.info(
                                "[QWEN:ITEM:RETRY:DONE] requestId=%s globalIndex=%d attempt=%d retryDurationMs=%s elapsedMs=%d text=%r",
                                request_id,
                                global_idx,
                                retry_attempt,
                                retry_duration_ms,
                                elapsed_ms(retry_started),
                                bad_text,
                            )

                            if not is_abnormal_audio_duration(retry_duration_ms):
                                retry_wav = retry_wavs[0]
                                break

                            logger.error(
                                "[QWEN:ITEM:RETRY:ABNORMAL] requestId=%s globalIndex=%d attempt=%d durationMs=%s maxDurationMs=%d text=%r",
                                request_id,
                                global_idx,
                                retry_attempt,
                                retry_duration_ms,
                                MAX_AUDIO_DURATION_MS,
                                bad_text,
                            )

                        if retry_wav is None:
                            raise HTTPException(
                                status_code=502,
                                detail=(
                                    f"Qwen generated abnormal audio duration at index={global_idx}, "
                                    f"durationMs={retry_duration_ms or duration_ms}"
                                ),
                            )

                        chunk_wavs[local_idx] = retry_wav

                    log_cuda_memory(request_id, f"CHUNK_{chunk_index}_AFTER")

                    chunk_ms = elapsed_ms(chunk_started)

                    chunk_timings.append(
                        {
                            "chunk": chunk_index,
                            "start": chunk_start,
                            "count": len(chunk),
                            "elapsedMs": chunk_ms,
                        }
                    )

                    if sr is None:
                        sr = chunk_sr

                    wavs.extend(chunk_wavs)

                    logger.info(
                        "[QWEN:CHUNK:DONE] requestId=%s chunk=%d/%d count=%d elapsedMs=%d",
                        request_id,
                        chunk_index,
                        chunk_total,
                        len(chunk_wavs),
                        chunk_ms,
                    )

                infer_ms = elapsed_ms(infer_started)

        if sr is None:
            raise HTTPException(status_code=500, detail="Qwen returned no audio")

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

            if is_abnormal_audio_duration(duration_ms):
                logger.error(
                    "[QWEN:ITEM:TOO_LONG] requestId=%s index=%d textLen=%d durationMs=%s maxDurationMs=%d text=%r",
                    request_id,
                    idx,
                    text_lens[idx] if idx < len(text_lens) else None,
                    duration_ms,
                    MAX_AUDIO_DURATION_MS,
                    texts[idx] if idx < len(texts) else None,
                )
                raise HTTPException(
                    status_code=502,
                    detail=f"Qwen generated abnormal audio duration at index={idx}, durationMs={duration_ms}",
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
                "chunks": chunk_timings,
            },
            "audios": audios,
        }

    finally:
        if torch.cuda.is_available():
            log_cuda_memory(request_id, "REQ_FINALLY_BEFORE_EMPTY_CACHE")
            torch.cuda.empty_cache()
            log_cuda_memory(request_id, "REQ_FINALLY_AFTER_EMPTY_CACHE")