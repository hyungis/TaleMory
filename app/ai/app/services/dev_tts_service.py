from __future__ import annotations

import json
import shutil
import wave
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from urllib import error, request
from collections.abc import Callable
from typing import Any
from uuid import uuid4

from app.core.config import settings
from app.schemas.tts import PreviewOptions, VoiceRegisterRequest
from app.services.cosyvoice_client import synthesize_cross_lingual_tts
from app.services.storage_service import (
    build_public_url,
    download_s3_bytes,
    store_bytes,
    store_file,
)


SAMPLE_RATE = 22050
SAMPLE_WIDTH = 2
CHANNELS = 1
ASSISTANT_PREFIX = "You are a helpful assistant. Read slowly.<|endofprompt|>"

EMOTION_INSTRUCTIONS = {
    "NEUTRAL": "Neutral.",
    "WARM": "Warm.",
    "HAPPY": "Happy.",
    "EXCITED": "Excited.",
    "CALM": "Calm.",
    "SAD": "Sad.",
    "SOFT": "Soft.",
    "SERIOUS": "Serious.",
    "ANGRY": "Angry.",
    "NARRATION": "Calm narration.",
}


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    _ensure_parent(path)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _safe_voice_id() -> str:
    return f"vce_{uuid4().hex[:12]}"


def _manifest_path(job_id: str | int) -> Path:
    return settings.TTS_MANIFEST_ROOT / "jobs" / f"{job_id}.json"


def _voice_dir(voice_id: str) -> Path:
    return settings.TTS_STORAGE_ROOT / "voices" / voice_id


def _voice_metadata_path(voice_id: str) -> Path:
    return _voice_dir(voice_id) / "metadata.json"


def _voice_reference_path(voice_id: str) -> Path:
    return _voice_dir(voice_id) / "reference.wav"


def _copy_or_generate_reference(source: str, target: Path) -> None:
    _ensure_parent(target)
    if source.startswith("file:///"):
        candidate = Path(source.replace("file:///", "", 1))
    else:
        candidate = Path(source)

    if not candidate.exists() or not candidate.is_file():
        raise FileNotFoundError(f"Uploaded source file not found: {candidate}")
    if candidate.suffix.lower() != ".wav":
        raise ValueError("Only .wav source audio is supported")

    shutil.copyfile(candidate, target)


def _is_http_url(value: str) -> bool:
    lowered = value.lower()
    return lowered.startswith("http://") or lowered.startswith("https://")


def _looks_like_s3_key(value: str) -> bool:
    """
    raw S3 key (not URL) 인지 휴리스틱 판정.
    env-prefix(local/dev/prod) 가 앞에 붙은 키도 인식하도록 — http(s):// 가 아니면서
    path 안에 `stories/` 가 들어있으면 raw key 로 간주.
    """
    if _is_http_url(value):
        return False
    return "stories/" in value


def _download_url_bytes(url: str) -> bytes:
    try:
        with request.urlopen(url, timeout=60) as response:
            return response.read()
    except error.URLError as exc:
        raise RuntimeError(f"Failed to download reference audio from URL: {exc.reason}") from exc


def resolve_reference_voice(
    voice_id: str,
    reference_audio_url: str | None = None,
    reference_audio_s3_key: str | None = None,
) -> Path:
    reference_path = _voice_reference_path(voice_id)
    if reference_path.exists():
        return reference_path

    remote_s3_key = reference_audio_s3_key
    remote_url = reference_audio_url
    if remote_s3_key is None and remote_url and _looks_like_s3_key(remote_url):
        remote_s3_key = remote_url
        remote_url = None

    if remote_s3_key:
        audio_bytes = download_s3_bytes(remote_s3_key)
    elif remote_url and _is_http_url(remote_url):
        audio_bytes = _download_url_bytes(remote_url)
    else:
        raise FileNotFoundError(
            f"Reference voice not found locally and no downloadable remote source provided: {voice_id}"
        )

    _ensure_parent(reference_path)
    reference_path.write_bytes(audio_bytes)
    return reference_path


def _duration_ms_from_audio(audio_bytes: bytes, audio_format: str, fallback_text: str) -> int:
    if audio_format == "wav":
        try:
            with wave.open(BytesIO(audio_bytes), "rb") as wav_file:
                frames = wav_file.getnframes()
                framerate = wav_file.getframerate()
                if framerate > 0:
                    return int((frames / framerate) * 1000)
        except wave.Error:
            pass

    return int(max(1000, min(6000, len(fallback_text) * 80)))


def _audio_content_type(audio_format: str) -> str:
    if audio_format == "wav":
        return "audio/wav"
    if audio_format == "mp3":
        return "audio/mpeg"
    return "application/octet-stream"


def _cross_lingual_text(text: str) -> str:
    normalized = text.strip()
    if normalized.startswith(ASSISTANT_PREFIX):
        return normalized
    return f"{ASSISTANT_PREFIX}{normalized}"


def _voice_metadata(voice_id: str) -> dict[str, Any]:
    metadata_path = _voice_metadata_path(voice_id)
    if not metadata_path.exists():
        raise FileNotFoundError(voice_id)
    return _read_json(metadata_path)


def _concat_wavs(paths: list[Path], output_path: Path, pause_ms: int = 900) -> None:
    if not paths:
        raise ValueError("No wav files to concatenate")

    _ensure_parent(output_path)
    with wave.open(str(paths[0]), "rb") as first_file:
        nchannels = first_file.getnchannels()
        sampwidth = first_file.getsampwidth()
        framerate = first_file.getframerate()

    with wave.open(str(output_path), "wb") as out_file:
        out_file.setnchannels(nchannels)
        out_file.setsampwidth(sampwidth)
        out_file.setframerate(framerate)

        silence_frame_count = int(framerate * max(0, pause_ms) / 1000)
        silence = b"\x00" * silence_frame_count * nchannels * sampwidth

        for index, path in enumerate(paths):
            with wave.open(str(path), "rb") as in_file:
                if (
                    in_file.getnchannels() != nchannels
                    or in_file.getsampwidth() != sampwidth
                    or in_file.getframerate() != framerate
                ):
                    raise ValueError("All story sentence wav files must share the same audio parameters")
                out_file.writeframes(in_file.readframes(in_file.getnframes()))
                if index < len(paths) - 1 and silence:
                    out_file.writeframes(silence)


def create_pending_manifest(job_id: str | int, job_type: str, extra: dict[str, Any]) -> None:
    payload = {
        "success": True,
        "data": {
            "jobId": str(job_id),
            "jobType": job_type,
            "status": "PENDING",
            "createdAt": _now(),
            **extra,
        },
        "message": None,
    }
    _write_json(_manifest_path(job_id), payload)


def update_manifest(job_id: str | int, data: dict[str, Any]) -> None:
    path = _manifest_path(job_id)
    payload = _read_json(path) if path.exists() else {"success": True, "data": {}, "message": None}
    payload["data"].update(data)
    _write_json(path, payload)


def read_manifest(job_id: str | int) -> dict[str, Any]:
    return _read_json(_manifest_path(job_id))


def create_voice_clone_job(request: VoiceRegisterRequest) -> dict[str, Any]:
    voice_id = _safe_voice_id()
    job_id = f"voice_clone_{uuid4().hex[:12]}"
    create_pending_manifest(job_id, "VOICE_CLONE", {"voiceId": voice_id})
    return {
        "jobId": job_id,
        "jobType": "VOICE_CLONE",
        "status": "PENDING",
        "voiceId": voice_id,
        "request": request.model_dump(),
    }


def process_voice_clone_job(job_id: str, voice_id: str, request: VoiceRegisterRequest) -> None:
    update_manifest(job_id, {"status": "RUNNING", "startedAt": _now()})
    try:
        reference_path = _voice_reference_path(voice_id)
        _copy_or_generate_reference(request.sourceAudio.path, reference_path)
        stored_reference = store_file(reference_path, "audio/wav")

        metadata = {
            "voiceId": voice_id,
            "label": request.label,
            "durationSec": 2.0,
            "sampleRate": SAMPLE_RATE,
            "channels": CHANNELS,
            "language": request.language,
            "createdAt": _now(),
            "cache": {
                "promptCached": request.options.generatePromptCache,
                "embeddingCached": False,
            },
            "referenceAudio": {
                "audioUrl": stored_reference.url,
                "s3Key": stored_reference.key,
            },
        }
        _write_json(_voice_metadata_path(voice_id), metadata)

        update_manifest(
            job_id,
            {
                "status": "SUCCESS",
                "finishedAt": _now(),
                "progress": 100,
                "result": {
                    "voiceId": voice_id,
                    "label": request.label,
                    "referenceAudio": {
                        "path": str(reference_path),
                        "audioUrl": stored_reference.url,
                        "s3Key": stored_reference.key,
                    },
                    "metadata": metadata,
                },
            },
        )
    except Exception as error:
        update_manifest(
            job_id,
            {
                "status": "FAILED",
                "finishedAt": _now(),
                "error": {"message": str(error)},
            },
        )


def get_voice_info(voice_id: str) -> dict[str, Any]:
    metadata = _voice_metadata(voice_id)
    reference_path = _voice_reference_path(voice_id)
    reference_audio = metadata.get("referenceAudio", {})
    return {
        "voiceId": voice_id,
        "label": metadata["label"],
        "status": "SUCCESS",
        "language": metadata["language"],
        "referenceAudioUrl": reference_audio.get("audioUrl") or build_public_url(reference_path),
        "referenceAudioS3Key": reference_audio.get("s3Key"),
        "durationSec": metadata["durationSec"],
        "cache": metadata["cache"],
        "createdAt": metadata["createdAt"],
    }


def generate_preview(
    voice_id: str,
    text: str,
    language: str,
    output_format: str,
    options: PreviewOptions,
    reference_audio_url: str | None = None,
    reference_audio_s3_key: str | None = None,
) -> dict[str, Any]:
    reference_path = resolve_reference_voice(voice_id, reference_audio_url, reference_audio_s3_key)

    preview_id = f"preview_{uuid4().hex[:12]}"
    audio_bytes, resolved_format = synthesize_cross_lingual_tts(
        text=_cross_lingual_text(text),
        prompt_wav_path=reference_path,
        audio_format=output_format,
    )
    output_path = (
        settings.TTS_STORAGE_ROOT
        / "generated"
        / "voice-preview"
        / voice_id
        / f"{preview_id}.{resolved_format}"
    )
    stored_audio = store_bytes(output_path, audio_bytes, _audio_content_type(resolved_format))
    duration_ms = _duration_ms_from_audio(audio_bytes, resolved_format, text)

    return {
        "previewId": preview_id,
        "audio": {
            "audioUrl": stored_audio.url,
            "s3Key": stored_audio.key,
            "durationMs": duration_ms,
            "format": resolved_format,
        },
        "appliedStyle": {
            "emotion": options.emotion,
            "stylePrompt": options.stylePrompt,
            "speakingRate": options.speakingRate,
            "pitch": options.pitch,
            "engine": "cosyvoice.inference_cross_lingual",
        },
    }


def create_story_tts_job(request: dict[str, Any]) -> dict[str, Any]:
    job_id = f"story_tts_{uuid4().hex[:12]}"
    create_pending_manifest(job_id, "TTS", {"storyId": request["storyId"], "voiceId": request["voiceId"]})
    return {
        "jobId": job_id,
        "jobType": "TTS",
        "status": "PENDING",
        "storyId": request["storyId"],
    }


def generate_story_tts_result(
    request: dict[str, Any],
    progress_callback: Callable[[int], None] | None = None,
) -> dict[str, Any]:
    voice_id = request["voiceId"]
    reference_path = resolve_reference_voice(
        voice_id,
        request.get("referenceAudioUrl"),
        request.get("referenceAudioS3Key"),
    )

    story_id = request["storyId"]
    sentence_paths: list[Path] = []
    items: list[dict[str, Any]] = []

    default_emotion = request["options"]["defaultEmotion"]
    default_style_prompt = request["options"].get("defaultStylePrompt")
    output_format = request.get("format", "wav")

    for index, sentence in enumerate(request["sentences"], start=1):
        sentence_id = sentence["sentenceId"]
        emotion = sentence.get("emotion") or default_emotion
        style_prompt = sentence.get("stylePrompt") or default_style_prompt
        audio_bytes, resolved_format = synthesize_cross_lingual_tts(
            text=_cross_lingual_text(sentence["text"]),
            prompt_wav_path=reference_path,
            audio_format=output_format,
        )
        sentence_path = (
            settings.TTS_STORAGE_ROOT
            / "generated"
            / "story-tts"
            / str(story_id)
            / "sentences"
            / f"{sentence_id}.{resolved_format}"
        )
        stored_sentence = store_bytes(sentence_path, audio_bytes, _audio_content_type(resolved_format))
        if resolved_format == "wav":
            sentence_paths.append(sentence_path)
        items.append(
            {
                "sentenceId": sentence_id,
                "appliedStyle": {
                    "emotion": emotion,
                    "stylePrompt": style_prompt,
                },
                "audio": {
                    "audioUrl": stored_sentence.url,
                    "s3Key": stored_sentence.key,
                    "durationMs": _duration_ms_from_audio(audio_bytes, resolved_format, sentence["text"]),
                    "format": resolved_format,
                },
            }
        )
        if progress_callback is not None:
            progress_callback(min(95, int(index / len(request["sentences"]) * 90) + 5))

    result: dict[str, Any] = {
        "storyId": story_id,
        "voiceId": voice_id,
        "items": items,
        "sceneSentenceUpdates": [
            {
                "sentenceId": item["sentenceId"],
                "ttsAudioUrl": item["audio"]["audioUrl"],
                "ttsAudioS3Key": item["audio"]["s3Key"],
            }
            for item in items
        ],
        "summary": {
            "sentenceCount": len(items),
        },
    }

    if request["options"].get("generateFullBookAudio") and sentence_paths and all(
        item["audio"]["format"] == "wav" for item in items
    ):
        full_book_path = (
            settings.TTS_STORAGE_ROOT / "generated" / "story-tts" / str(story_id) / "full-book" / "full-book.wav"
        )
        _concat_wavs(sentence_paths, full_book_path)
        stored_full_book = store_file(full_book_path, "audio/wav")
        result["fullBookAudio"] = {
            "audioUrl": stored_full_book.url,
            "s3Key": stored_full_book.key,
            "format": "wav",
        }
    elif request["options"].get("generateFullBookAudio"):
        result["fullBookAudio"] = None

    return result


def process_story_tts_job(job_id: str, request: dict[str, Any]) -> None:
    update_manifest(job_id, {"status": "RUNNING", "startedAt": _now(), "progress": 5})

    try:
        result = generate_story_tts_result(
            request,
            progress_callback=lambda progress: update_manifest(job_id, {"progress": progress}),
        )
    except Exception as error:
        message = f"Voice not found: {error}" if isinstance(error, FileNotFoundError) else str(error)
        update_manifest(
            job_id,
            {
                "status": "FAILED",
                "finishedAt": _now(),
                "error": {"message": message},
            },
        )
        return

    update_manifest(
        job_id,
        {
            "status": "SUCCESS",
            "finishedAt": _now(),
            "progress": 100,
            "result": result,
        },
    )
