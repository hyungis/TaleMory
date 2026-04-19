from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_generate_storyboard() -> None:
    response = client.post(
        "/internal/storyboards/generate",
        json={
            "storyId": 1,
            "children": [{"name": "Haesol", "age": 7}],
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
    assert body["pageCount"] == 10
    assert len(body["pages"]) == 10
    assert body["pages"][0]["sourcePhotoIds"] == [101]
    assert body["usage"]["promptTemplateVersion"] == "storyboard_v1"
