from __future__ import annotations

import json
import logging
import re
import shutil
from time import perf_counter
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
from app.services.qwen_server_client import synthesize_voice_clone_tts, synthesize_voice_clone_tts_batch
from app.services.storage_service import (
    build_public_url,
    download_s3_bytes,
    store_bytes,
    store_file,
)

logger = logging.getLogger(__name__)

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
    "CURIOUS": "Curious.",
    "SURPRISED": "Surprised.",
    "SAD": "Sad.",
    "TENDER": "Tender.",
    "BRAVE": "Brave.",
}


def _tts_engine() -> str:
    return settings.TTS_ENGINE.strip().lower()


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _elapsed_ms(started: float) -> int:
    return int((perf_counter() - started) * 1000)


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


_S3_KEY_PATTERN = re.compile(r"^([a-z][a-z0-9-]*/)?stories/")


def _looks_like_s3_key(value: str) -> bool:
    """
    raw S3 key (not URL) 인지 판정.

    허용 패턴:
      - 레거시 raw key: `stories/...`
      - env-prefixed: `local/stories/...`, `dev/stories/...`, `prod/stories/...` 등

    단순 `"stories/" in value` 보다 좁혀 — 자유 텍스트 안에 우연히 "stories/" 가 끼어든
    false-positive 를 차단하기 위해 path-shaped 첫 segment 만 허용.
    """
    if _is_http_url(value):
        return False
    return bool(_S3_KEY_PATTERN.match(value))


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
    started = perf_counter()
    reference_path = _voice_reference_path(voice_id)
    if reference_path.exists():
        logger.info(
            "[TTS:REFERENCE] voiceId=%s source=cache elapsedMs=%d",
            voice_id,
            _elapsed_ms(started),
        )
        return reference_path

    remote_s3_key = reference_audio_s3_key
    remote_url = reference_audio_url
    if remote_s3_key is None and remote_url and _looks_like_s3_key(remote_url):
        remote_s3_key = remote_url
        remote_url = None

    if remote_s3_key:
        download_started = perf_counter()
        audio_bytes = download_s3_bytes(remote_s3_key)
        logger.info(
            "[TTS:REFERENCE:DOWNLOAD] voiceId=%s source=s3 key=%s bytes=%d elapsedMs=%d",
            voice_id,
            remote_s3_key,
            len(audio_bytes),
            _elapsed_ms(download_started),
        )
    elif remote_url and _is_http_url(remote_url):
        download_started = perf_counter()
        audio_bytes = _download_url_bytes(remote_url)
        logger.info(
            "[TTS:REFERENCE:DOWNLOAD] voiceId=%s source=url bytes=%d elapsedMs=%d",
            voice_id,
            len(audio_bytes),
            _elapsed_ms(download_started),
        )
    else:
        raise FileNotFoundError(
            f"Reference voice not found locally and no downloadable remote source provided: {voice_id}"
        )

    _ensure_parent(reference_path)
    reference_path.write_bytes(audio_bytes)
    logger.info(
        "[TTS:REFERENCE] voiceId=%s source=remote elapsedMs=%d",
        voice_id,
        _elapsed_ms(started),
    )
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


def _synthesize_tts(
    *,
    text: str,
    prompt_wav_path: Path,
    audio_format: str,
    language: str | None,
) -> tuple[bytes, str]:
    if _tts_engine() == "qwen":
        return synthesize_voice_clone_tts(
            text=text,
            prompt_wav_path=prompt_wav_path,
            audio_format=audio_format,
            language=language,
        )
    return synthesize_cross_lingual_tts(
        text=_cross_lingual_text(text),
        prompt_wav_path=prompt_wav_path,
        audio_format=audio_format,
    )


def _synthesize_tts_batch(
    *,
    texts: list[str],
    prompt_wav_path: Path,
    audio_format: str,
    language: str | None,
) -> list[tuple[bytes, str]]:
    if _tts_engine() == "qwen":
        return synthesize_voice_clone_tts_batch(
            texts=texts,
            prompt_wav_path=prompt_wav_path,
            audio_format=audio_format,
            language=language,
        )
    return [
        synthesize_cross_lingual_tts(
            text=_cross_lingual_text(text),
            prompt_wav_path=prompt_wav_path,
            audio_format=audio_format,
        )
        for text in texts
    ]


def _voice_metadata(voice_id: str) -> dict[str, Any]:
    metadata_path = _voice_metadata_path(voice_id)
    if not metadata_path.exists():
        raise FileNotFoundError(voice_id)
    return _read_json(metadata_path)


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
    started = perf_counter()
    reference_path = resolve_reference_voice(voice_id, reference_audio_url, reference_audio_s3_key)

    preview_id = f"preview_{uuid4().hex[:12]}"
    engine_started = perf_counter()
    audio_bytes, resolved_format = _synthesize_tts(
        text=text,
        prompt_wav_path=reference_path,
        audio_format=output_format,
        language=language,
    )
    logger.info(
        "[TTS_PREVIEW:ENGINE] engine=%s previewId=%s voiceId=%s textLen=%d audioBytes=%d elapsedMs=%d",
        _tts_engine(),
        preview_id,
        voice_id,
        len(text),
        len(audio_bytes),
        _elapsed_ms(engine_started),
    )
    output_path = (
        settings.TTS_STORAGE_ROOT
        / "generated"
        / "voice-preview"
        / voice_id
        / f"{preview_id}.{resolved_format}"
    )
    store_started = perf_counter()
    stored_audio = store_bytes(output_path, audio_bytes, _audio_content_type(resolved_format))
    logger.info(
        "[TTS_PREVIEW:STORE] previewId=%s voiceId=%s storageMode=%s elapsedMs=%d audioUrl=%s",
        preview_id,
        voice_id,
        settings.TTS_STORAGE_MODE,
        _elapsed_ms(store_started),
        stored_audio.url,
    )
    duration_ms = _duration_ms_from_audio(audio_bytes, resolved_format, text)
    logger.info(
        "[TTS_PREVIEW:GENERATE:DONE] previewId=%s voiceId=%s durationMs=%d elapsedMs=%d",
        preview_id,
        voice_id,
        duration_ms,
        _elapsed_ms(started),
    )

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
            "engine": _tts_engine(),
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
    started = perf_counter()
    voice_id = request["voiceId"]
    story_mode = request.get("storyMode", "VIEWER")
    story_id = request["storyId"]

    default_emotion = request["options"]["defaultEmotion"]
    default_style_prompt = request["options"].get("defaultStylePrompt")
    output_format = request.get("format", "wav")
    items: list[dict[str, Any]] = []
    sentences = request["sentences"]
    default_voice_ref = {
        "speakerKey": "narrator",
        "voiceId": voice_id,
        "referenceAudioUrl": request.get("referenceAudioUrl"),
        "referenceAudioS3Key": request.get("referenceAudioS3Key"),
    }
    voice_refs = {
        ref["speakerKey"]: ref
        for ref in request.get("voiceRefs", [])
        if ref.get("speakerKey") and ref.get("voiceId")
    }

    def voice_ref_for(sentence: dict[str, Any]) -> dict[str, Any]:
        speaker_key = sentence.get("speakerKey") or "narrator"
        return voice_refs.get(speaker_key) or default_voice_ref

    grouped_sentences: dict[tuple[str, str | None, str | None], list[dict[str, Any]]] = {}
    for sentence in sentences:
        ref = voice_ref_for(sentence)
        key = (ref["voiceId"], ref.get("referenceAudioUrl"), ref.get("referenceAudioS3Key"))
        grouped_sentences.setdefault(key, []).append(sentence)

    audio_by_sentence_id: dict[int, tuple[bytes, str, str, int]] = {}
    total_engine_elapsed = 0
    for (group_voice_id, reference_audio_url, reference_audio_s3_key), group in grouped_sentences.items():
        reference_path = resolve_reference_voice(
            group_voice_id,
            reference_audio_url,
            reference_audio_s3_key,
        )
        engine_started = perf_counter()
        audio_results = _synthesize_tts_batch(
            texts=[sentence["text"] for sentence in group],
            prompt_wav_path=reference_path,
            audio_format=output_format,
            language=request.get("language"),
        )
        engine_elapsed = _elapsed_ms(engine_started)
        total_engine_elapsed += engine_elapsed
        for sentence, audio_result in zip(group, audio_results, strict=True):
            audio_bytes, resolved_format = audio_result
            audio_by_sentence_id[sentence["sentenceId"]] = (
                audio_bytes,
                resolved_format,
                group_voice_id,
                engine_elapsed,
            )

    for index, sentence in enumerate(sentences, start=1):
        sentence_id = sentence["sentenceId"]
        emotion = sentence.get("emotion") or default_emotion
        style_prompt = sentence.get("stylePrompt") or default_style_prompt
        speaker_key = sentence.get("speakerKey")
        sentence_started = perf_counter()
        audio_bytes, resolved_format, sentence_voice_id, engine_elapsed = audio_by_sentence_id[sentence_id]
        sentence_path = (
            settings.TTS_STORAGE_ROOT
            / "generated"
            / "story-tts"
            / str(story_id)
            / str(sentence_voice_id)
            / "sentences"
            / f"{sentence_id}.{resolved_format}"
        )
        store_started = perf_counter()
        stored_sentence = store_bytes(sentence_path, audio_bytes, _audio_content_type(resolved_format))
        store_elapsed = _elapsed_ms(store_started)
        logger.info(
            "[TTS:STORY:SENTENCE] engine=%s storyId=%s voiceId=%s sentenceId=%s index=%d/%d textLen=%d audioBytes=%d engineBatchMs=%d storeMs=%d elapsedMs=%d",
            _tts_engine(),
            story_id,
            voice_id,
            sentence_id,
            index,
            len(sentences),
            len(sentence["text"]),
            len(audio_bytes),
            engine_elapsed,
            store_elapsed,
            _elapsed_ms(sentence_started),
        )
        items.append(
            {
                "sentenceId": sentence_id,
                "speakerKey": speaker_key,
                "voiceId": sentence_voice_id,
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
            progress_callback(min(95, int(index / len(sentences) * 90) + 5))

    result: dict[str, Any] = {
        "storyId": story_id,
        "storyMode": story_mode,
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
        "usage": {
            "model": _tts_engine(),
            "inputTokens": None,
            "outputTokens": None,
            "totalTokens": None,
            "costUsd": None,
            "promptTemplateVersion": "tts_webtoon_v1" if story_mode == "WEBTOON" else "tts_v1",
        },
    }

    logger.info(
        "[TTS:STORY:GENERATE:DONE] storyId=%s storyMode=%s voiceId=%s voiceGroups=%d sentenceCount=%d engineMs=%d elapsedMs=%d",
        story_id,
        story_mode,
        voice_id,
        len(grouped_sentences),
        len(items),
        total_engine_elapsed,
        _elapsed_ms(started),
    )
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
