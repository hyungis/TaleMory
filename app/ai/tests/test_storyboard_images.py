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
    assert body["results"][0]["imageUrl"] == "https://cdn.example.com/storyboards/stories/1/storyboard-image/1/v1.png"
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

    def fake_generate_item_with_gemini(story_id, item, seed, output_version=None):
        del story_id
        assert output_version is None
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

    def fake_generate_storyboard_character_reference(request_model):
        return storyboard_image_service.StoryboardCharacterReferenceGenerateResponse(
            storyId=request_model.storyId,
            seed=request_model.seed,
            imageUrl="https://cdn.example.com/storyboards/stories/1/storyboard-character/reference.png",
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
    original_generate_storyboard_character_reference = storyboard_image_service.generate_storyboard_character_reference
    storyboard_image_service._generate_item_with_gemini = fake_generate_item_with_gemini
    storyboard_image_service.generate_storyboard_character_reference = fake_generate_storyboard_character_reference
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
        storyboard_image_service.generate_storyboard_character_reference = original_generate_storyboard_character_reference

    assert response.seed == 555777999
    assert captured_seeds == [555777999, 555777999]


def test_generate_storyboard_images_uses_top_level_character_source_images() -> None:
    captured_reference_sources: dict[str, list[str]] = {}

    def fake_generate_storyboard_character_reference(request_model):
        captured_reference_sources["urls"] = request_model.referenceImageUrls
        captured_reference_sources["s3_keys"] = request_model.referenceImageS3Keys
        return storyboard_image_service.StoryboardCharacterReferenceGenerateResponse(
            storyId=request_model.storyId,
            seed=request_model.seed,
            imageUrl="https://cdn.example.com/storyboards/stories/1/storyboard-character/reference.png",
            usage=storyboard_image_service.StoryboardImageUsage(
                provider="local",
                model=settings.STORYBOARD_IMAGE_MODEL,
                promptTokens=0,
                candidateTokens=0,
                totalTokens=0,
                imageCount=1,
                costUsd=0.0,
            ),
        )

    original_generate_character_reference = storyboard_image_service.generate_storyboard_character_reference
    storyboard_image_service.generate_storyboard_character_reference = fake_generate_storyboard_character_reference
    try:
        items = storyboard_image_service.ensure_storyboard_character_reference(
            story_id=1,
            seed=1234,
            character_source_image_urls=["https://example.com/child.jpg"],
            character_source_image_s3_keys=[
                "stories/1/character-source/child-closeup.jpg",
                "stories/1/character-source/family-photo.jpg",
            ],
            items=[
                storyboard_image_service.StoryboardImageGenerateItemRequest.model_validate(
                    {
                        "pageNumber": 1,
                        "storyboard": {
                            "title": "리나의 와이키키 모험",
                            "synopsis": "가족과 함께한 따뜻한 여행 이야기",
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
                        "referenceImageS3Keys": ["stories/1/page-scene/ignored-for-character.jpg"],
                    }
                )
            ],
        )
    finally:
        storyboard_image_service.generate_storyboard_character_reference = original_generate_character_reference

    assert captured_reference_sources["urls"] == ["https://example.com/child.jpg"]
    assert captured_reference_sources["s3_keys"] == [
        "stories/1/character-source/child-closeup.jpg",
        "stories/1/character-source/family-photo.jpg",
    ]
    assert items[0].characterReferenceImageS3Keys == ["stories/1/storyboard-character/reference.png"]
    assert items[0].characterReferenceImageUrls == [
        "https://cdn.example.com/storyboards/stories/1/storyboard-character/reference.png"
    ]


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
            "outputVersion": 2,
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
    assert body["outputVersion"] == 2
    assert body["result"]["pageNumber"] == 1
    assert body["result"]["imageUrl"] == "https://cdn.example.com/storyboards/stories/1/storyboard-image/1/v2.png"
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
        assert character_reference_image_s3_keys == ["stories/1/storyboard-character/reference.png"]
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
                    "outputVersion": 3,
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
    assert response.outputVersion == 3
    assert response.result.pageNumber == 1
    assert response.result.imageUrl == "https://cdn.example.com/storyboards/stories/1/storyboard-image/1/v3.png"
    assert "## Additional Instruction" in captured_prompt["value"]
    assert "- 따뜻한 동화책 느낌" in captured_prompt["value"]
    assert "User regeneration request: 리나 표정을 더 신나게 바꿔줘" in captured_prompt["value"]


def test_regenerate_storyboard_image_uses_default_character_reference_when_missing() -> None:
    settings.GEMINI_API_KEY = "test-key"
    captured_character_refs: dict[str, list[str]] = {}

    def fake_call_gemini_image_api(
        final_prompt: str,
        character_reference_image_urls: list[str],
        character_reference_image_s3_keys: list[str],
        reference_image_urls: list[str],
        reference_image_s3_keys: list[str],
        seed: int,
    ) -> dict:
        del final_prompt, reference_image_urls, reference_image_s3_keys, seed
        captured_character_refs["urls"] = character_reference_image_urls
        captured_character_refs["s3_keys"] = character_reference_image_s3_keys
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
        storyboard_image_service.regenerate_storyboard_image(
            storyboard_image_service.StoryboardImageRegenerateRequest.model_validate(
                {
                    "storyId": 1,
                    "seed": 4321,
                    "outputVersion": 2,
                    "userPrompt": "리나 표정을 더 신나게 바꿔줘",
                    "item": {
                        "pageNumber": 1,
                        "storyboard": {
                            "title": "리나의 와이키키 모험",
                            "synopsis": "가족과 함께한 따뜻한 여행 이야기",
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
                    },
                }
            )
        )
    finally:
        storyboard_image_service._call_gemini_image_api = original_call

    assert captured_character_refs["urls"] == []
    assert captured_character_refs["s3_keys"] == ["stories/1/storyboard-character/reference.png"]


def test_regenerate_storyboard_image_requires_user_prompt() -> None:
    response = client.post(
        "/internal/storyboard-images/regenerate",
        json={
            "storyId": 1,
            "seed": 1234,
            "outputVersion": 2,
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
