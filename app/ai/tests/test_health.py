import shutil
import struct
import wave
from io import BytesIO
import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services import dev_tts_service


client = TestClient(app)


def _wav_bytes() -> bytes:
    buffer = BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(22050)
        wav_file.writeframes(struct.pack("<h", 0) * 22050)
    return buffer.getvalue()


def setup_module() -> None:
    shutil.rmtree(settings.TTS_STORAGE_ROOT, ignore_errors=True)
    shutil.rmtree(settings.TTS_MANIFEST_ROOT, ignore_errors=True)
    Path(settings.TTS_STORAGE_ROOT).mkdir(parents=True, exist_ok=True)
    Path(settings.TTS_MANIFEST_ROOT).mkdir(parents=True, exist_ok=True)


def _seed_voice(voice_id: str = "vce_testvoice01") -> str:
    voice_dir = Path(settings.TTS_STORAGE_ROOT) / "voices" / voice_id
    voice_dir.mkdir(parents=True, exist_ok=True)
    (voice_dir / "reference.wav").write_bytes(_wav_bytes())
    (voice_dir / "metadata.json").write_text(
        json.dumps(
            {
                "voiceId": voice_id,
                "label": "mom-bedtime",
                "durationSec": 1.0,
                "sampleRate": 22050,
                "channels": 1,
                "language": "ko-KR",
                "createdAt": "2026-01-01T00:00:00+00:00",
                "cache": {"promptCached": False, "embeddingCached": False},
            }
        ),
        encoding="utf-8",
    )
    return voice_id


def test_read_root() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["message"] == "S210 AI API is running"


def test_read_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_voice_register_preview_and_story_flow() -> None:
    original_base_url = settings.COSYVOICE_BASE_URL
    original_synthesizer = dev_tts_service.synthesize_instruct_tts
    settings.COSYVOICE_BASE_URL = "http://cosyvoice.test"
    voice_id = _seed_voice()

    def fake_synthesize_instruct_tts(*, text: str, instruct_text: str, prompt_wav_path: Path, audio_format: str) -> tuple[bytes, str]:
        assert text
        assert instruct_text
        assert prompt_wav_path.exists()
        assert audio_format == "wav"
        return _wav_bytes(), "wav"

    dev_tts_service.synthesize_instruct_tts = fake_synthesize_instruct_tts

    try:
        preview_response = client.post(
            f"/api/v1/voices/{voice_id}/preview",
            json={
                "text": "잘 자요. 이제 이야기를 시작할게요.",
                "language": "ko-KR",
                "format": "wav",
                "options": {
                    "emotion": "WARM",
                    "stylePrompt": "Read gently like a caring mother at bedtime.",
                    "speakingRate": 0.92,
                    "pitch": -0.5,
                    "volumeGain": 1.0,
                    "useSsml": False,
                },
            },
        )
        assert preview_response.status_code == 200
        preview_data = preview_response.json()["data"]
        assert preview_data["audio"]["audioUrl"].startswith("/static/")
        assert preview_data["audio"]["format"] == "wav"
        assert preview_data["appliedStyle"]["engine"] == "cosyvoice.inference_instruct2"

        story_response = client.post(
            "/api/v1/tts/story",
            json={
                "storyId": 1201,
                "voiceId": voice_id,
                "language": "ko-KR",
                "format": "wav",
                "options": {
                    "defaultEmotion": "NEUTRAL",
                    "defaultStylePrompt": "Read clearly like a story narrator.",
                    "speakingRate": 0.94,
                    "pitch": 0.0,
                    "volumeGain": 1.0,
                    "useSsml": False,
                },
                "sentences": [
                    {
                        "sentenceId": 5001,
                        "pageNumber": 1,
                        "sentenceOrder": 1,
                        "text": "Mina saw the ocean for the first time.",
                        "speakerKey": "narrator",
                        "emotion": "WARM",
                        "stylePrompt": "Read warmly and softly.",
                        "ssml": None,
                    },
                    {
                        "sentenceId": 5002,
                        "pageNumber": 1,
                        "sentenceOrder": 2,
                        "text": "\"Wow,\" she whispered.",
                        "speakerKey": "mina",
                        "emotion": "EXCITED",
                        "stylePrompt": "Read with bright excitement.",
                        "ssml": None,
                    },
                ],
            },
        )
        assert story_response.status_code == 200
        story_job_id = story_response.json()["data"]["jobId"]

        story_job_response = client.get(f"/api/v1/jobs/{story_job_id}")
        assert story_job_response.status_code == 200
        story_data = story_job_response.json()["data"]
        assert story_data["status"] == "SUCCESS"
        assert len(story_data["result"]["items"]) == 2
        assert story_data["result"]["items"][0]["audio"]["audioUrl"].startswith("/static/")
    finally:
        dev_tts_service.synthesize_instruct_tts = original_synthesizer
        settings.COSYVOICE_BASE_URL = original_base_url
