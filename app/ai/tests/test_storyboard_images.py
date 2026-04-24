from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services import storyboard_image_service


client = TestClient(app)


def setup_function() -> None:
    settings.GEMINI_API_KEY = None
    settings.STORYBOARD_IMAGE_PUBLIC_BASE_URL = "https://cdn.example.com/storyboards"
    settings.STORYBOARD_IMAGE_S3_BUCKET = None
    settings.STORYBOARD_IMAGE_S3_REGION = None
    settings.STORYBOARD_IMAGE_S3_ACCESS_KEY_ID = None
    settings.STORYBOARD_IMAGE_S3_SECRET_ACCESS_KEY = None
    settings.STORYBOARD_IMAGE_S3_ENDPOINT_URL = None


def test_generate_storyboard_images_uses_local_fallback_when_gemini_key_missing() -> None:
    response = client.post(
        "/internal/storyboard-images/generate",
        json={
            "storyId": 1,
            "items": [
                {
                    "pageNumber": 1,
                    "storyboard": {
                        "title": "리나의 와이키키 모험",
                        "synopsis": "가족과 함께한 따뜻한 여행 이야기",
                        "moralTheme": "가족의 소중함",
                        "recurringMotif": "노을 속에서의 순간들",
                    },
                    "page": {
                        "pageNumber": 1,
                        "sceneSummary": "리나가 와이키키에 도착한 장면",
                        "englishText": "Lina arrived at Waikiki with her family.",
                        "koreanText": "리나는 가족과 함께 와이키키에 도착했다.",
                        "imagePrompt": "Warm storybook illustration of a family arriving at Waikiki beach",
                    },
                    "children": [
                        {
                            "name": "리나",
                            "age": 7,
                            "gender": "FEMALE",
                        }
                    ],
                    "companions": ["엄마", "아빠"],
                    "referenceImageUrls": [],
                    "additionalInstruction": "따뜻한 동화책 느낌",
                }
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["storyId"] == 1
    assert len(body["results"]) == 1
    assert body["results"][0]["pageNumber"] == 1
    assert body["results"][0]["imageUrl"] == "https://cdn.example.com/storyboards/1/1.png"
    assert "rough children's storybook sketch" in body["results"][0]["finalPrompt"]
    assert "no polished final rendering" in body["results"][0]["finalPrompt"]
    assert "Do not render any words" in body["results"][0]["finalPrompt"]
    assert body["results"][0]["usage"]["model"] == settings.STORYBOARD_IMAGE_MODEL
    assert body["usage"]["totalImages"] == 1
