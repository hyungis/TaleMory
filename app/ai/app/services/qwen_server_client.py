from __future__ import annotations

import base64
import json
import logging
import uuid
from pathlib import Path
from time import perf_counter
from typing import Any
from urllib import error, request

from app.core.config import settings

logger = logging.getLogger(__name__)


class QwenTtsError(RuntimeError):
    """Base exception for Qwen TTS server synthesis failures."""


class QwenTtsNotConfiguredError(QwenTtsError):
    """Raised when the Qwen TTS server endpoint is not configured."""


class QwenTtsInvocationError(QwenTtsError):
    """Raised when the Qwen TTS server returns an unusable response."""


def synthesize_voice_clone_tts(
    *,
    text: str,
    prompt_wav_path: Path,
    audio_format: str,
    language: str | None = None,
) -> tuple[bytes, str]:
    return synthesize_voice_clone_tts_batch(
        texts=[text],
        prompt_wav_path=prompt_wav_path,
        audio_format=audio_format,
        language=language,
    )[0]


def synthesize_voice_clone_tts_batch(
    *,
    texts: list[str],
    prompt_wav_path: Path,
    audio_format: str,
    language: str | None = None,
) -> list[tuple[bytes, str]]:
    if not settings.QWEN_TTS_SERVER_URL:
        raise QwenTtsNotConfiguredError("Qwen TTS requires QWEN_TTS_SERVER_URL to be configured.")
    if not texts:
        return []

    started = perf_counter()
    endpoint = _build_endpoint(settings.QWEN_TTS_SERVER_URL, settings.QWEN_TTS_VOICE_CLONE_PATH)
    body, content_type = _build_multipart_payload(
        fields={
            "texts_json": json.dumps(texts, ensure_ascii=False),
            "language": _language_name(language),
            "ref_text": "",
            "x_vector_only_mode": str(settings.QWEN_TTS_X_VECTOR_ONLY_MODE).lower(),
            "response_format": audio_format,
        },
        files={"ref_audio": prompt_wav_path},
    )
    payload = _post_multipart(endpoint=endpoint, body=body, content_type=content_type)
    audios = payload.get("audios")
    if not isinstance(audios, list):
        raise QwenTtsInvocationError("Qwen TTS response did not include audios list.")
    if len(audios) != len(texts):
        raise QwenTtsInvocationError(
            f"Qwen TTS returned {len(audios)} audios for {len(texts)} requested texts."
        )

    results: list[tuple[bytes, str]] = []
    for item in sorted(audios, key=lambda value: int(value.get("index", 0))):
        audio_base64 = item.get("audioBase64") or item.get("audio_base64")
        if not audio_base64:
            raise QwenTtsInvocationError("Qwen TTS audio item did not include audioBase64.")
        try:
            audio_bytes = base64.b64decode(str(audio_base64))
        except ValueError as exc:
            raise QwenTtsInvocationError("Qwen TTS audioBase64 payload is invalid.") from exc
        resolved_format = str(item.get("format") or audio_format or "wav").lower()
        results.append((audio_bytes, resolved_format))

    logger.info(
        "[QWEN_TTS:HTTP] endpoint=%s textCount=%d audioBytes=%d elapsedMs=%d",
        endpoint,
        len(texts),
        sum(len(audio_bytes) for audio_bytes, _ in results),
        _elapsed_ms(started),
    )
    return results


def _post_multipart(*, endpoint: str, body: bytes, content_type: str) -> dict[str, Any]:
    req = request.Request(
        endpoint,
        data=body,
        headers={
            "Accept": "application/json",
            "Content-Type": content_type,
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=settings.QWEN_TTS_TIMEOUT_SEC) as response:
            response_bytes = response.read()
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore").strip()
        suffix = f" Response: {detail}" if detail else ""
        raise QwenTtsInvocationError(f"Qwen TTS returned HTTP {exc.code}.{suffix}") from exc
    except error.URLError as exc:
        raise QwenTtsInvocationError(f"Qwen TTS request failed: {exc.reason}") from exc

    try:
        return json.loads(response_bytes.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise QwenTtsInvocationError("Qwen TTS returned invalid JSON.") from exc


def _build_endpoint(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _build_multipart_payload(
    *,
    fields: dict[str, str],
    files: dict[str, Path],
) -> tuple[bytes, str]:
    boundary = f"----S210QwenTts{uuid.uuid4().hex}"
    chunks: list[bytes] = []

    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                value.encode("utf-8"),
                b"\r\n",
            ]
        )

    for name, path in files.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                (
                    f'Content-Disposition: form-data; name="{name}"; filename="{path.name}"\r\n'
                ).encode("utf-8"),
                b"Content-Type: audio/wav\r\n\r\n",
                path.read_bytes(),
                b"\r\n",
            ]
        )

    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def _language_name(language: str | None) -> str:
    if not language:
        return _language_name(settings.TTS_DEFAULT_LANGUAGE)
    lowered = language.lower()
    if lowered.startswith("ko"):
        return "Korean"
    if lowered.startswith("en"):
        return "English"
    if lowered.startswith("zh"):
        return "Chinese"
    if lowered.startswith("ja"):
        return "Japanese"
    return "Auto"


def _elapsed_ms(started: float) -> int:
    return int((perf_counter() - started) * 1000)
