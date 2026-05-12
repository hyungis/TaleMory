from app.schemas.storyboard import StoryboardGenerateRequest
from app.core.config import settings
from app.services.storyboard_prompt import STORYBOARD_SYSTEM_PROMPT, WEBTOON_STORYBOARD_SYSTEM_PROMPT
from app.services.storyboard_service import (
    _build_openai_webtoon_input_content,
    _reconcile_webtoon_derived_counts,
    _to_gemini_json_schema,
    generate_storyboard,
    generate_webtoon_storyboard,
)
from app.schemas.storyboard import (
    ReadingLevel,
    UsageInfo,
    WebtoonCharacterInScene,
    WebtoonStoryboardGenerateResponse,
    WebtoonStoryboardPage,
    WebtoonStorySentence,
)


def setup_function() -> None:
    settings.OPENAI_API_KEY = None
    settings.GEMINI_API_KEY = None


def test_storyboard_system_prompt_requires_rough_sketch_image_prompt() -> None:
    assert "rough pre-coloring storyboard sketch" in STORYBOARD_SYSTEM_PROMPT
    assert "not a polished final illustration" in STORYBOARD_SYSTEM_PROMPT


def test_webtoon_prompt_requires_multiple_sentences_per_page() -> None:
    assert "Each page must contain at least 3 sentences" in WEBTOON_STORYBOARD_SYSTEM_PROMPT
    assert "Never return a page with only one sentence" in WEBTOON_STORYBOARD_SYSTEM_PROMPT


def test_webtoon_prompt_rejects_dialogue_attribution_tags() -> None:
    assert "must contain only the spoken words" in WEBTOON_STORYBOARD_SYSTEM_PROMPT
    assert "she says" in WEBTOON_STORYBOARD_SYSTEM_PROMPT
    assert "그녀는 말한다" in WEBTOON_STORYBOARD_SYSTEM_PROMPT


def test_gemini_schema_inlines_defs_for_structured_output() -> None:
    schema = _to_gemini_json_schema(StoryboardGenerateRequest.model_json_schema())

    assert "$defs" not in schema
    assert "$ref" not in str(schema)
    assert "title" not in schema
    assert schema["properties"]["children"]["items"]["type"] == "object"


def test_gemini_webtoon_input_can_omit_image_blocks() -> None:
    request = StoryboardGenerateRequest.model_validate(
        {
            "storyId": 1,
            "children": [{"name": "Lina", "age": 5, "gender": "FEMALE"}],
            "companions": ["Mom"],
            "travel": {"place": "Tokyo", "startDate": None, "endDate": None},
            "photos": [
                {
                    "photoId": 101,
                    "s3Key": "stories/test/1.jpg",
                    "imageUrl": "https://example.com/photo.jpg",
                    "description": "A family trip photo",
                    "hashtags": ["family"],
                    "displayOrder": 1,
                }
            ],
            "difficulty": "BEGINNER",
        }
    )

    content = _build_openai_webtoon_input_content(
        request,
        request.model_dump(mode="json"),
        include_images=False,
    )

    assert all(block["type"] != "input_image" for block in content)


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


def test_webtoon_reconcile_removes_dialogue_speaker_attribution() -> None:
    response = WebtoonStoryboardGenerateResponse(
        title="Test",
        synopsis="Test",
        moralTheme="bravery",
        storyQuest="rest",
        recurringMotif="family",
        pageCount=1,
        pageCountReason="test",
        readingLevel=ReadingLevel(
            basedOnAge=5,
            sentencesPerPage="3-5",
            wordsPerSentence="8-14",
            reason="test",
        ),
        totalWordCount=0,
        pages=[
            WebtoonStoryboardPage(
                pageNumber=1,
                sourcePhotoIds=[105],
                sceneSummary="Yujin needs rest.",
                englishText="",
                koreanText="",
                imagePrompt="Yujin rests with Mom.",
                charactersInScene=[
                    WebtoonCharacterInScene(
                        characterKey="이유진",
                        sceneRole="resting",
                        expectedPosition="center",
                    )
                ],
                sentences=[
                    WebtoonStorySentence(
                        sentenceOrder=1,
                        type="DIALOGUE",
                        speakerKey="이유진",
                        englishText="\"Mommy, I'm tired!\" she says.",
                        koreanText="\"엄마, 쉬어야 해요!\" 그녀는 말한다.",
                        emotion="SAD",
                    )
                ],
                sentenceCount=1,
                wordCount=0,
            )
        ],
        usage=UsageInfo(
            model="test",
            inputTokens=0,
            outputTokens=0,
            totalTokens=0,
            costUsd=0,
            promptTemplateVersion="test",
        ),
    )

    _reconcile_webtoon_derived_counts(response)

    sentence = response.pages[0].sentences[0]
    assert sentence.englishText == "Mommy, I'm tired!"
    assert sentence.koreanText == "엄마, 쉬어야 해요!"
    assert response.pages[0].englishText == "Mommy, I'm tired!"
    assert response.pages[0].koreanText == "엄마, 쉬어야 해요!"

