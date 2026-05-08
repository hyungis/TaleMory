from app.schemas.storyboard import StoryboardGenerateRequest
from app.core.config import settings
from app.services.storyboard_prompt import STORYBOARD_SYSTEM_PROMPT, WEBTOON_STORYBOARD_SYSTEM_PROMPT
from app.services.storyboard_service import (
    generate_storyboard,
    generate_webtoon_storyboard,
)


def setup_function() -> None:
    settings.OPENAI_API_KEY = None


def test_storyboard_system_prompt_requires_rough_sketch_image_prompt() -> None:
    assert "rough pre-coloring storyboard sketch" in STORYBOARD_SYSTEM_PROMPT
    assert "not a polished final illustration" in STORYBOARD_SYSTEM_PROMPT


def test_webtoon_prompt_requires_multiple_sentences_per_page() -> None:
    assert "Each page must contain at least 3 sentences" in WEBTOON_STORYBOARD_SYSTEM_PROMPT
    assert "Never return a page with only one sentence" in WEBTOON_STORYBOARD_SYSTEM_PROMPT


def test_local_storyboard_generation_uses_rough_sketch_image_prompt() -> None:
    request = StoryboardGenerateRequest.model_validate(
        {
            "storyId": 1,
            "children": [{"name": "리나", "age": 7, "gender": "FEMALE"}],
            "companions": ["엄마", "아빠"],
            "travel": {
                "place": "Waikiki",
                "startDate": "2026-01-10",
                "endDate": "2026-01-14",
            },
            "photos": [
                {
                    "photoId": 101,
                    "description": "리나가 해변에 도착해 바다를 바라보는 장면",
                    "hashtags": ["beach", "arrival"],
                    "displayOrder": 1,
                }
            ],
            "difficulty": "BEGINNER",
        }
    )

    response = generate_storyboard(request)
    image_prompt = response.pages[0].imagePrompt

    assert "rough pre-coloring children's book storyboard sketch" in image_prompt
    assert "no polished final rendering" in image_prompt


def test_local_webtoon_storyboard_uses_multiple_sentences_per_page() -> None:
    request = StoryboardGenerateRequest.model_validate(
        {
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
                    "hashtags": ["beach", "arrival"],
                    "displayOrder": 1,
                }
            ],
            "difficulty": "BEGINNER",
        }
    )

    response = generate_webtoon_storyboard(request)

    assert response.pages
    assert all(page.sentenceCount >= 3 for page in response.pages)

