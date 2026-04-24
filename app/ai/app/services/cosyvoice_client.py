from __future__ import annotations

import base64
import json
import uuid
from pathlib import Path
from typing import Any
from urllib import error, request

from app.core.config import settings


class CosyVoiceError(RuntimeError):
    """Base exception for CosyVoice synthesis failures."""


class CosyVoiceNotConfiguredError(CosyVoiceError):
    """Raised when the CosyVoice endpoint is not configured."""


class CosyVoiceInvocationError(CosyVoiceError):
    """Raised when the CosyVoice endpoint returns an unusable response."""


def synthesize_cross_lingual_tts(
    *,
    text: str,
    prompt_wav_path: Path,
    audio_format: str,
) -> tuple[bytes, str]:
    if not settings.COSYVOICE_BASE_URL:
        raise CosyVoiceNotConfiguredError(
            "CosyVoice preview requires COSYVOICE_BASE_URL to be configured."
        )

    endpoint = _build_endpoint(settings.COSYVOICE_BASE_URL, settings.COSYVOICE_CROSS_LINGUAL_PATH)
    body, content_type = _build_multipart_payload(
        fields={
            "tts_text": text,
            "format": audio_format,
        },
        files={"prompt_wav": prompt_wav_path},
    )
    return _invoke_cosyvoice(endpoint=endpoint, body=body, content_type=content_type, audio_format=audio_format)


def synthesize_zero_shot_tts(
    *,
    text: str,
    prompt_text: str,
    prompt_wav_path: Path,
    audio_format: str,
) -> tuple[bytes, str]:
    if not settings.COSYVOICE_BASE_URL:
        raise CosyVoiceNotConfiguredError(
            "CosyVoice preview requires COSYVOICE_BASE_URL to be configured."
        )

    endpoint = _build_endpoint(settings.COSYVOICE_BASE_URL, settings.COSYVOICE_ZERO_SHOT_PATH)
    body, content_type = _build_multipart_payload(
        fields={
            "tts_text": text,
            "prompt_text": prompt_text,
            "format": audio_format,
        },
        files={"prompt_wav": prompt_wav_path},
    )
    return _invoke_cosyvoice(endpoint=endpoint, body=body, content_type=content_type, audio_format=audio_format)


def synthesize_instruct_tts(
    *,
    text: str,
    instruct_text: str,
    prompt_wav_path: Path,
    audio_format: str,
) -> tuple[bytes, str]:
    if not settings.COSYVOICE_BASE_URL:
        raise CosyVoiceNotConfiguredError(
            "CosyVoice preview requires COSYVOICE_BASE_URL to be configured."
        )

    endpoint = _build_endpoint(settings.COSYVOICE_BASE_URL, settings.COSYVOICE_INSTRUCT_PATH)
    body, content_type = _build_multipart_payload(
        fields={
            "tts_text": text,
            "instruct_text": instruct_text,
            "format": audio_format,
        },
        files={"prompt_wav": prompt_wav_path},
    )
    return _invoke_cosyvoice(endpoint=endpoint, body=body, content_type=content_type, audio_format=audio_format)


def _invoke_cosyvoice(
    *,
    endpoint: str,
    body: bytes,
    content_type: str,
    audio_format: str,
) -> tuple[bytes, str]:
    req = request.Request(
        endpoint,
        data=body,
        headers={
            "Accept": "application/json, audio/wav, audio/mpeg, audio/*",
            "Content-Type": content_type,
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=settings.COSYVOICE_TIMEOUT_SEC) as response:
            response_bytes = response.read()
            content_type = response.headers.get("Content-Type", "").lower()
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore").strip()
        suffix = f" Response: {detail}" if detail else ""
        raise CosyVoiceInvocationError(f"CosyVoice returned HTTP {exc.code}.{suffix}") from exc
    except error.URLError as exc:
        raise CosyVoiceInvocationError(f"CosyVoice request failed: {exc.reason}") from exc

    if content_type.startswith("audio/"):
        return response_bytes, _format_from_content_type(content_type, audio_format)

    try:
        decoded = json.loads(response_bytes.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise CosyVoiceInvocationError(
            "CosyVoice returned neither audio bytes nor JSON audio payload."
        ) from exc

    audio_base64 = _find_first(decoded, ("audioBase64", "audio_base64", "wavBase64", "wav_base64"))
    if not audio_base64:
        raise CosyVoiceInvocationError(
            "CosyVoice JSON response did not include audioBase64/audio_base64."
        )

    try:
        audio_bytes = base64.b64decode(audio_base64)
    except ValueError as exc:
        raise CosyVoiceInvocationError("CosyVoice audioBase64 payload is invalid.") from exc

    resolved_format = _find_first(decoded, ("format", "audioFormat", "audio_format")) or audio_format
    return audio_bytes, str(resolved_format).lower()


def _build_endpoint(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _build_multipart_payload(
    *,
    fields: dict[str, str],
    files: dict[str, Path],
) -> tuple[bytes, str]:
    boundary = f"----CodexCosyVoice{uuid.uuid4().hex}"
    chunks: list[bytes] = []

    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                str(value).encode("utf-8"),
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


def _format_from_content_type(content_type: str, fallback: str) -> str:
    if "mpeg" in content_type or "mp3" in content_type:
        return "mp3"
    if "wav" in content_type or "wave" in content_type:
        return "wav"
    return fallback


def _find_first(payload: Any, keys: tuple[str, ...]) -> Any:
    if isinstance(payload, dict):
        for key in keys:
            if key in payload and payload[key] is not None:
                return payload[key]
        for value in payload.values():
            found = _find_first(value, keys)
            if found is not None:
                return found
    elif isinstance(payload, list):
        for item in payload:
            found = _find_first(item, keys)
            if found is not None:
                return found
    return None
