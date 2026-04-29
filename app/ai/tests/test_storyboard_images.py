import json

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
            "seed": 1234,
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
    assert body["seed"] == 1234
    assert len(body["results"]) == 1
    assert body["results"][0]["pageNumber"] == 1
    assert body["results"][0]["imageUrl"] == "https://cdn.example.com/storyboards/stories/1/storyboard-image/1.png"
    assert "finalPrompt" not in body["results"][0]
    assert body["results"][0]["usage"]["model"] == settings.STORYBOARD_IMAGE_MODEL
    assert body["usage"]["totalImages"] == 1


def test_call_gemini_image_api_sends_requested_seed() -> None:
    settings.GEMINI_API_KEY = "test-key"
    captured_payload: dict[str, object] = {}

    class MockResponse:
        def __enter__(self) -> "MockResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return json.dumps({"candidates": [], "usageMetadata": {}}).encode("utf-8")

    def fake_urlopen(req, timeout=180):
        del timeout
        captured_payload.update(json.loads(req.data.decode("utf-8")))
        return MockResponse()

    original_urlopen = storyboard_image_service.request.urlopen
    storyboard_image_service.request.urlopen = fake_urlopen
    try:
        storyboard_image_service._call_gemini_image_api("seeded prompt", [], [], [], [], 987654321)
    finally:
        storyboard_image_service.request.urlopen = original_urlopen

    generation_config = captured_payload["generationConfig"]
    assert generation_config["responseModalities"] == ["Image"]
    assert generation_config["seed"] == 987654321


def test_generate_storyboard_images_reuses_one_generated_seed_for_all_items() -> None:
    settings.GEMINI_API_KEY = "test-key"
    captured_seeds: list[int] = []

    def fake_generate_item_with_gemini(story_id, item, seed):
        del story_id
        captured_seeds.append(seed)
        return storyboard_image_service.StoryboardImageGenerateResult(
            pageNumber=item.pageNumber,
            imageUrl=f"https://cdn.example.com/storyboards/stories/1/storyboard-image/{item.pageNumber}.png",
            usage=storyboard_image_service.StoryboardImageUsage(
                provider="google",
                model=settings.STORYBOARD_IMAGE_MODEL,
                promptTokens=1,
                candidateTokens=1,
                totalTokens=2,
                imageCount=1,
                costUsd=None,
            ),
        )

    original_generate_item_with_gemini = storyboard_image_service._generate_item_with_gemini
    storyboard_image_service._generate_item_with_gemini = fake_generate_item_with_gemini
    try:
        response = storyboard_image_service.generate_storyboard_images(
            storyboard_image_service.StoryboardImageGenerateRequest.model_validate(
                {
                    "storyId": 1,
                    "seed": 555777999,
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
                            "children": [{"name": "리나", "age": 7, "gender": "FEMALE"}],
                            "companions": ["엄마", "아빠"],
                            "referenceImageUrls": [],
                        },
                        {
                            "pageNumber": 2,
                            "storyboard": {
                                "title": "리나의 와이키키 모험",
                                "synopsis": "가족과 함께한 따뜻한 여행 이야기",
                                "moralTheme": "가족의 소중함",
                                "recurringMotif": "노을 속에서의 순간들",
                            },
                            "page": {
                                "pageNumber": 2,
                                "sceneSummary": "리나가 해변을 거니는 장면",
                                "englishText": "Lina walked along the beach.",
                                "koreanText": "리나는 해변을 걸었다.",
                                "imagePrompt": "Warm storybook sketch of a child walking on Waikiki beach",
                            },
                            "children": [{"name": "리나", "age": 7, "gender": "FEMALE"}],
                            "companions": ["엄마", "아빠"],
                            "referenceImageUrls": [],
                        },
                    ],
                }
            )
        )
    finally:
        storyboard_image_service._generate_item_with_gemini = original_generate_item_with_gemini

    assert response.seed == 555777999
    assert captured_seeds == [555777999, 555777999]


def test_generate_storyboard_images_requires_seed() -> None:
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
                }
            ],
        },
    )

    assert response.status_code == 422


def test_regenerate_storyboard_image_uses_local_fallback_when_gemini_key_missing() -> None:
    response = client.post(
        "/internal/storyboard-images/regenerate",
        json={
            "storyId": 1,
            "seed": 1234,
            "userPrompt": "리나가 더 환하게 웃도록 바꿔줘",
            "item": {
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
                "children": [{"name": "리나", "age": 7, "gender": "FEMALE"}],
                "companions": ["엄마", "아빠"],
                "referenceImageUrls": [],
                "additionalInstruction": "따뜻한 동화책 느낌",
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["storyId"] == 1
    assert body["seed"] == 1234
    assert body["result"]["pageNumber"] == 1
    assert body["result"]["imageUrl"] == "https://cdn.example.com/storyboards/stories/1/storyboard-image/1.png"
    assert body["result"]["usage"]["model"] == settings.STORYBOARD_IMAGE_MODEL


def test_regenerate_storyboard_image_appends_user_prompt_to_existing_instruction() -> None:
    settings.GEMINI_API_KEY = "test-key"
    captured_prompt: dict[str, str] = {}

    def fake_call_gemini_image_api(
        final_prompt: str,
        character_reference_image_urls: list[str],
        character_reference_image_s3_keys: list[str],
        reference_image_urls: list[str],
        reference_image_s3_keys: list[str],
        seed: int,
    ) -> dict:
        captured_prompt["value"] = final_prompt
        assert character_reference_image_urls == []
        assert character_reference_image_s3_keys == []
        assert reference_image_urls == ["https://example.com/reference.png"]
        assert reference_image_s3_keys == []
        assert seed == 4321
        return {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "inlineData": {
                                    "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn8J9sAAAAASUVORK5CYII="
                                }
                            }
                        ]
                    }
                }
            ],
            "usageMetadata": {},
        }

    original_call = storyboard_image_service._call_gemini_image_api
    storyboard_image_service._call_gemini_image_api = fake_call_gemini_image_api
    try:
        response = storyboard_image_service.regenerate_storyboard_image(
            storyboard_image_service.StoryboardImageRegenerateRequest.model_validate(
                {
                    "storyId": 1,
                    "seed": 4321,
                    "userPrompt": "리나 표정을 더 신나게 바꿔줘",
                    "item": {
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
                        "children": [{"name": "리나", "age": 7, "gender": "FEMALE"}],
                        "companions": ["엄마", "아빠"],
                        "referenceImageUrls": ["https://example.com/reference.png"],
                        "additionalInstruction": "따뜻한 동화책 느낌",
                    },
                }
            )
        )
    finally:
        storyboard_image_service._call_gemini_image_api = original_call

    assert response.seed == 4321
    assert response.result.pageNumber == 1
    assert "Additional instruction: 따뜻한 동화책 느낌" in captured_prompt["value"]
    assert "User regeneration request: 리나 표정을 더 신나게 바꿔줘" in captured_prompt["value"]


def test_regenerate_storyboard_image_requires_user_prompt() -> None:
    response = client.post(
        "/internal/storyboard-images/regenerate",
        json={
            "storyId": 1,
            "seed": 1234,
            "item": {
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
                "children": [{"name": "리나", "age": 7, "gender": "FEMALE"}],
                "companions": ["엄마", "아빠"],
                "referenceImageUrls": [],
            },
        },
    )

    assert response.status_code == 422
