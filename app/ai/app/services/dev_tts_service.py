from __future__ import annotations

import json
import math
import shutil
import struct
import wave
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.core.config import settings
from app.schemas.tts import PreviewOptions, StorySentenceRequest, VoiceRegisterRequest


SAMPLE_RATE = 22050
SAMPLE_WIDTH = 2
CHANNELS = 1

EMOTION_FREQUENCY = {
    "NEUTRAL": 440.0,
    "WARM": 392.0,
    "HAPPY": 523.25,
    "EXCITED": 659.25,
    "CALM": 349.23,
    "SAD": 261.63,
    "SOFT": 329.63,
    "SERIOUS": 293.66,
    "ANGRY": 587.33,
    "NARRATION": 415.30,
}


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _public_url(path: Path) -> str:
    relative = path.relative_to(settings.TTS_STORAGE_ROOT).as_posix()
    return f"{settings.TTS_PUBLIC_BASE_URL.rstrip('/')}/{relative}"


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


def _copy_or_generate_reference(source: str, target: Path, label: str) -> None:
    _ensure_parent(target)
    if source.startswith("file:///"):
        candidate = Path(source.replace("file:///", "", 1))
    else:
        candidate = Path(source)

    if candidate.exists() and candidate.is_file() and candidate.suffix.lower() == ".wav":
        shutil.copyfile(candidate, target)
        return

    duration = max(1.2, min(4.0, 1.0 + len(label) * 0.08))
    _generate_tone_wav(target, frequency=392.0, duration_sec=duration, amplitude=0.25)


def _generate_tone_wav(
    path: Path,
    *,
    frequency: float,
    duration_sec: float,
    amplitude: float = 0.30,
) -> None:
    _ensure_parent(path)
    total_frames = max(1, int(SAMPLE_RATE * duration_sec))
    amplitude_i16 = int(32767 * max(0.0, min(1.0, amplitude)))

    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(CHANNELS)
        wav_file.setsampwidth(SAMPLE_WIDTH)
        wav_file.setframerate(SAMPLE_RATE)

        frames = bytearray()
        for index in range(total_frames):
            sample = amplitude_i16 * math.sin((2.0 * math.pi * frequency * index) / SAMPLE_RATE)
            frames.extend(struct.pack("<h", int(sample)))
        wav_file.writeframes(bytes(frames))


def _concat_wavs(paths: list[Path], output_path: Path) -> None:
    if not paths:
        raise ValueError("No wav files to concatenate")

    _ensure_parent(output_path)
    with wave.open(str(output_path), "wb") as out_file:
        out_file.setnchannels(CHANNELS)
        out_file.setsampwidth(SAMPLE_WIDTH)
        out_file.setframerate(SAMPLE_RATE)

        for path in paths:
            with wave.open(str(path), "rb") as in_file:
                out_file.writeframes(in_file.readframes(in_file.getnframes()))


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
    reference_path = _voice_reference_path(voice_id)
    _copy_or_generate_reference(request.sourceAudio.s3Key, reference_path, request.label)

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
                    "audioUrl": _public_url(reference_path),
                },
                "metadata": metadata,
            },
        },
    )


def get_voice_info(voice_id: str) -> dict[str, Any]:
    metadata_path = _voice_metadata_path(voice_id)
    if not metadata_path.exists():
        raise FileNotFoundError(voice_id)

    metadata = _read_json(metadata_path)
    reference_path = _voice_reference_path(voice_id)
    return {
        "voiceId": voice_id,
        "label": metadata["label"],
        "status": "SUCCESS",
        "language": metadata["language"],
        "referenceAudioUrl": _public_url(reference_path),
        "durationSec": metadata["durationSec"],
        "cache": metadata["cache"],
        "createdAt": metadata["createdAt"],
    }


def generate_preview(
    voice_id: str,
    text: str,
    output_format: str,
    options: PreviewOptions,
) -> dict[str, Any]:
    reference_path = _voice_reference_path(voice_id)
    if not reference_path.exists():
        raise FileNotFoundError(voice_id)

    frequency = EMOTION_FREQUENCY[options.emotion]
    duration_sec = max(1.0, min(6.0, 0.08 * len(text)))
    preview_id = f"preview_{uuid4().hex[:12]}"
    output_path = settings.TTS_STORAGE_ROOT / "generated" / "voice-preview" / voice_id / f"{preview_id}.wav"
    _generate_tone_wav(output_path, frequency=frequency, duration_sec=duration_sec)

    return {
        "previewId": preview_id,
        "audio": {
            "audioUrl": _public_url(output_path),
            "durationMs": int(duration_sec * 1000),
            "format": "wav" if output_format != "wav" else output_format,
        },
        "appliedStyle": {
            "emotion": options.emotion,
            "stylePrompt": options.stylePrompt,
            "speakingRate": options.speakingRate,
            "pitch": options.pitch,
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


def process_story_tts_job(job_id: str, request: dict[str, Any]) -> None:
    voice_id = request["voiceId"]
    reference_path = _voice_reference_path(voice_id)
    if not reference_path.exists():
        update_manifest(
            job_id,
            {
                "status": "FAILED",
                "finishedAt": _now(),
                "error": {"message": f"Voice not found: {voice_id}"},
            },
        )
        return

    update_manifest(job_id, {"status": "RUNNING", "startedAt": _now(), "progress": 5})

    story_id = request["storyId"]
    sentence_paths: list[Path] = []
    items: list[dict[str, Any]] = []

    default_emotion = request["options"]["defaultEmotion"]
    default_style_prompt = request["options"].get("defaultStylePrompt")

    for index, sentence in enumerate(request["sentences"], start=1):
        sentence_id = sentence["sentenceId"]
        emotion = sentence.get("emotion") or default_emotion
        style_prompt = sentence.get("stylePrompt") or default_style_prompt
        frequency = EMOTION_FREQUENCY[emotion]
        duration_sec = max(1.0, min(8.0, 0.07 * len(sentence["text"])))
        sentence_path = (
            settings.TTS_STORAGE_ROOT
            / "generated"
            / "story-tts"
            / str(story_id)
            / "sentences"
            / f"{sentence_id}.wav"
        )
        _generate_tone_wav(sentence_path, frequency=frequency, duration_sec=duration_sec)
        sentence_paths.append(sentence_path)
        items.append(
            {
                "sentenceId": sentence_id,
                "appliedStyle": {
                    "emotion": emotion,
                    "stylePrompt": style_prompt,
                },
                "audio": {
                    "audioUrl": _public_url(sentence_path),
                    "durationMs": int(duration_sec * 1000),
                    "format": "wav",
                },
            }
        )
        update_manifest(job_id, {"progress": min(95, int(index / len(request["sentences"]) * 90) + 5)})

    result: dict[str, Any] = {
        "storyId": story_id,
        "voiceId": voice_id,
        "items": items,
        "sceneSentenceUpdates": [
            {"sentenceId": item["sentenceId"], "ttsAudioUrl": item["audio"]["audioUrl"]}
            for item in items
        ],
        "summary": {
            "sentenceCount": len(items),
        },
    }

    if request["options"].get("generateFullBookAudio") and sentence_paths:
        full_book_path = (
            settings.TTS_STORAGE_ROOT / "generated" / "story-tts" / str(story_id) / "full-book" / "full-book.wav"
        )
        _concat_wavs(sentence_paths, full_book_path)
        result["fullBookAudio"] = {
            "audioUrl": _public_url(full_book_path),
            "format": "wav",
        }

    update_manifest(
        job_id,
        {
            "status": "SUCCESS",
            "finishedAt": _now(),
            "progress": 100,
            "result": result,
        },
    )

