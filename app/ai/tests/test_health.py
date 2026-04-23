import shutil
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


client = TestClient(app)


def setup_module() -> None:
    shutil.rmtree(settings.TTS_STORAGE_ROOT, ignore_errors=True)
    shutil.rmtree(settings.TTS_MANIFEST_ROOT, ignore_errors=True)
    Path(settings.TTS_STORAGE_ROOT).mkdir(parents=True, exist_ok=True)
    Path(settings.TTS_MANIFEST_ROOT).mkdir(parents=True, exist_ok=True)


def test_read_root() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["message"] == "S210 AI API is running"


def test_read_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_voice_register_preview_and_story_flow() -> None:
    register_response = client.post(
        "/api/v1/voices",
        json={
            "label": "mom-bedtime",
            "sourceAudio": {"s3Key": "missing-local-file.wav"},
            "scriptText": "민아야, 오늘은 엄마가 재미있는 동화를 읽어줄게.",
            "language": "ko-KR",
            "options": {
                "runNoiseCheck": True,
                "trimSilence": True,
                "normalizeVolume": True,
                "generatePromptCache": False,
            },
        },
    )
    assert register_response.status_code == 200

    register_payload = register_response.json()["data"]
    assert register_payload["jobType"] == "VOICE_CLONE"
    assert register_payload["status"] == "PENDING"
    voice_id = register_payload["voiceId"]
    voice_job_id = register_payload["jobId"]

    voice_response = client.get(f"/api/v1/voices/{voice_id}")
    assert voice_response.status_code == 200
    assert voice_response.json()["data"]["voiceId"] == voice_id

    voice_job_response = client.get(f"/api/v1/jobs/{voice_job_id}")
    assert voice_job_response.status_code == 200
    assert voice_job_response.json()["data"]["status"] == "SUCCESS"

    preview_response = client.post(
        f"/api/v1/voices/{voice_id}/preview",
        json={
            "text": "이제 잘 시간이야.",
            "language": "ko-KR",
            "format": "wav",
            "options": {
                "emotion": "WARM",
                "stylePrompt": "잠자리에서 읽어주듯 부드럽고 따뜻하게",
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

    story_response = client.post(
        "/api/v1/tts/story",
        json={
            "storyId": 1201,
            "voiceId": voice_id,
            "language": "ko-KR",
            "format": "wav",
            "options": {
                "defaultEmotion": "NARRATION",
                "defaultStylePrompt": "차분한 동화 나레이션 톤으로 또렷하게",
                "generateFullBookAudio": True,
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
                    "text": "민아는 처음으로 바다를 보았어요.",
                    "speakerKey": "narrator",
                    "emotion": "WARM",
                    "stylePrompt": "설레는 느낌을 조금 담아서",
                    "ssml": None,
                },
                {
                    "sentenceId": 5002,
                    "pageNumber": 1,
                    "sentenceOrder": 2,
                    "text": "\"우와,\" 하고 민아가 속삭였어요.",
                    "speakerKey": "mina",
                    "emotion": "EXCITED",
                    "stylePrompt": "밝고 신나는 감정을 살려서",
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
    assert story_data["result"]["fullBookAudio"]["audioUrl"].startswith("/static/")
