from __future__ import annotations

import json
import shutil
import wave
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.core.config import settings
from app.schemas.tts import PreviewOptions, VoiceRegisterRequest
from app.services.cosyvoice_client import synthesize_instruct_tts


SAMPLE_RATE = 22050
SAMPLE_WIDTH = 2
CHANNELS = 1

EMOTION_INSTRUCTIONS = {
    "NEUTRAL": "Speak naturally with a calm and clear tone.",
    "WARM": "Speak warmly and gently, like a caring parent reading at bedtime.",
    "HAPPY": "Speak cheerfully with a light and pleasant tone.",
    "EXCITED": "Speak brightly and excitedly, but keep the pronunciation clear.",
    "CALM": "Speak calmly with steady pacing and a composed tone.",
    "SAD": "Speak slowly and quietly with a subdued emotional tone.",
    "SOFT": "Speak softly and calmly with a low, relaxed energy.",
    "SERIOUS": "Speak with a serious and focused tone.",
    "ANGRY": "Speak with firm intensity, without shouting.",
    "NARRATION": "Read like a clear children's story narrator.",
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


def _write_bytes(path: Path, payload: bytes) -> None:
    _ensure_parent(path)
    path.write_bytes(payload)


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


def _language_instruction(language: str) -> str:
    if language == "ko-KR":
        return "Speak in Korean."
    if language == "en-US":
        return "Speak in English."
    return f"Speak in {language}."


def _preview_instruction(language: str, options: PreviewOptions) -> str:
    parts = [
        "Use the reference speaker's voice.",
        _language_instruction(language),
        EMOTION_INSTRUCTIONS[options.emotion],
    ]
    if options.speakingRate is not None:
        parts.append(f"Speaking rate: {options.speakingRate}.")
    if options.pitch is not None:
        parts.append(f"Pitch adjustment: {options.pitch}.")
    if options.volumeGain is not None:
        parts.append(f"Volume gain: {options.volumeGain}.")
    if options.stylePrompt:
        parts.append(f"Additional style: {options.stylePrompt}")
    return f'{" ".join(parts).strip()}<|endofprompt|>'


def _story_instruction(
    *,
    language: str,
    emotion: str,
    style_prompt: str | None,
    speaking_rate: float | None,
    pitch: float | None,
    volume_gain: float | None,
) -> str:
    parts = [
        "Use the reference speaker's voice.",
        _language_instruction(language),
        EMOTION_INSTRUCTIONS[emotion],
    ]
    if style_prompt:
        parts.append(f"Additional style: {style_prompt}")
    if speaking_rate is not None:
        parts.append(f"Speaking rate: {speaking_rate}.")
    if pitch is not None:
        parts.append(f"Pitch adjustment: {pitch}.")
    if volume_gain is not None:
        parts.append(f"Volume gain: {volume_gain}.")
    return f'{" ".join(parts).strip()}<|endofprompt|>'


def _concat_wavs(paths: list[Path], output_path: Path) -> None:
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

        for path in paths:
            with wave.open(str(path), "rb") as in_file:
                if (
                    in_file.getnchannels() != nchannels
                    or in_file.getsampwidth() != sampwidth
                    or in_file.getframerate() != framerate
                ):
                    raise ValueError("All story sentence wav files must share the same audio parameters")
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
    try:
        reference_path = _voice_reference_path(voice_id)
        _copy_or_generate_reference(request.sourceAudio.path, reference_path)

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
    language: str,
    output_format: str,
    options: PreviewOptions,
) -> dict[str, Any]:
    reference_path = _voice_reference_path(voice_id)
    if not reference_path.exists():
        raise FileNotFoundError(voice_id)

    preview_id = f"preview_{uuid4().hex[:12]}"
    instruction = _preview_instruction(language, options)
    audio_bytes, resolved_format = synthesize_instruct_tts(
        text=text,
        instruct_text=instruction,
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
    _write_bytes(output_path, audio_bytes)
    duration_ms = _duration_ms_from_audio(audio_bytes, resolved_format, text)

    return {
        "previewId": preview_id,
        "audio": {
            "audioUrl": _public_url(output_path),
            "durationMs": duration_ms,
            "format": resolved_format,
        },
        "appliedStyle": {
            "emotion": options.emotion,
            "stylePrompt": options.stylePrompt,
            "speakingRate": options.speakingRate,
            "pitch": options.pitch,
            "engine": "cosyvoice.inference_instruct2",
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
    speaking_rate = request["options"].get("speakingRate")
    pitch = request["options"].get("pitch")
    volume_gain = request["options"].get("volumeGain")
    output_format = request.get("format", "wav")

    try:
        for index, sentence in enumerate(request["sentences"], start=1):
            sentence_id = sentence["sentenceId"]
            emotion = sentence.get("emotion") or default_emotion
            style_prompt = sentence.get("stylePrompt") or default_style_prompt
            instruction = _story_instruction(
                language=request["language"],
                emotion=emotion,
                style_prompt=style_prompt,
                speaking_rate=speaking_rate,
                pitch=pitch,
                volume_gain=volume_gain,
            )
            audio_bytes, resolved_format = synthesize_instruct_tts(
                text=sentence["text"],
                instruct_text=instruction,
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
            _write_bytes(sentence_path, audio_bytes)
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
                        "audioUrl": _public_url(sentence_path),
                        "durationMs": _duration_ms_from_audio(audio_bytes, resolved_format, sentence["text"]),
                        "format": resolved_format,
                    },
                }
            )
            update_manifest(job_id, {"progress": min(95, int(index / len(request["sentences"]) * 90) + 5)})
    except Exception as error:
        update_manifest(
            job_id,
            {
                "status": "FAILED",
                "finishedAt": _now(),
                "error": {"message": str(error)},
            },
        )
        return

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

    if request["options"].get("generateFullBookAudio") and sentence_paths and all(
        item["audio"]["format"] == "wav" for item in items
    ):
        full_book_path = (
            settings.TTS_STORAGE_ROOT / "generated" / "story-tts" / str(story_id) / "full-book" / "full-book.wav"
        )
        _concat_wavs(sentence_paths, full_book_path)
        result["fullBookAudio"] = {
            "audioUrl": _public_url(full_book_path),
            "format": "wav",
        }
    elif request["options"].get("generateFullBookAudio"):
        result["fullBookAudio"] = None

    update_manifest(
        job_id,
        {
            "status": "SUCCESS",
            "finishedAt": _now(),
            "progress": 100,
            "result": result,
        },
    )
