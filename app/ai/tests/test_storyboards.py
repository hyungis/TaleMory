from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


client = TestClient(app)


def setup_function() -> None:
    settings.OPENAI_API_KEY = None


def test_generate_storyboard() -> None:
    response = client.post(
        "/internal/storyboards/generate",
        json={
            "storyId": 1,
            "children": [{"name": "Haesol", "age": 7, "gender": "FEMALE"}],
            "companions": ["Mom", "Dad"],
            "travel": {
                "place": "Waikiki",
                "startDate": "2026-01-10",
                "endDate": "2026-01-14",
            },
            "photos": [
                {
                    "photoId": 101,
                    "description": "Haesol put her feet in the ocean for the first time.",
                    "hashtags": ["beach", "first_time"],
                    "displayOrder": 1,
                }
            ],
            "difficulty": "BEGINNER",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert 10 <= body["pageCount"] <= 20
    assert len(body["pages"]) == body["pageCount"]
    referenced_photo_ids = {
        pid for page in body["pages"] for pid in page["sourcePhotoIds"]
    }
    assert referenced_photo_ids <= {101}
    assert 101 in referenced_photo_ids
    assert body["usage"]["promptTemplateVersion"] == "storyboard_v5"
    first_sentence = body["pages"][0]["sentences"][0]
    assert "emotion" in first_sentence
    assert first_sentence["emotion"] in {
        "NEUTRAL",
        "HAPPY",
        "SAD",
        "EXCITED",
        "CALM",
        "CURIOUS",
        "SURPRISED",
        "WARM",
        "TENDER",
        "BRAVE",
    }


def test_regenerate_storyboard() -> None:
    original_request = {
        "storyId": 1,
        "children": [{"name": "Haesol", "age": 7, "gender": "FEMALE"}],
        "companions": ["Mom", "Dad"],
        "travel": {
            "place": "Waikiki",
            "startDate": "2026-01-10",
            "endDate": "2026-01-14",
        },
        "photos": [
            {
                "photoId": 101,
                "description": "Haesol put her feet in the ocean for the first time.",
                "hashtags": ["beach", "first_time"],
                "displayOrder": 1,
            }
        ],
        "difficulty": "BEGINNER",
    }

    generated = client.post("/internal/storyboards/generate", json=original_request)
    assert generated.status_code == 200

    response = client.post(
        "/internal/storyboards/regenerate",
        json={
            "storyId": 1,
            "originalRequest": original_request,
            "currentStoryboard": generated.json(),
            "feedbackInstruction": "Make it feel more like a fairy tale and less like a diary.",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert 10 <= body["pageCount"] <= 20
    assert len(body["pages"]) == body["pageCount"]
    assert body["usage"]["promptTemplateVersion"] == "storyboard_v5"
