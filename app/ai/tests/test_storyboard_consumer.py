from app.core.config import settings
from app.consumers.storyboard_consumer import (
    handle_generate_message,
    handle_regenerate_message,
    handle_summary_generate_message,
    handle_summary_regenerate_message,
)
from app.schemas.storyboard import StoryboardGenerateResponse
from app.schemas.storyboard_summary import StoryboardSummaryGenerateResponse


class FakePublisher:
    def __init__(self) -> None:
        self.published_results: list[dict] = []
        self.published_failures: list[dict] = []

    def publish_result(
        self,
        job_id: str,
        story_id: int | None,
        payload: StoryboardGenerateResponse,
        action: str,
        story_mode: str = "VIEWER",
    ) -> None:
        self.published_results.append(
            {
                "job_id": job_id,
                "story_id": story_id,
                "payload": payload,
                "action": action,
                "story_mode": story_mode,
            }
        )

    def publish_failure(
        self,
        job_id: str,
        story_id: int | None,
        error,
        action: str,
        story_mode: str = "VIEWER",
    ) -> None:
        self.published_failures.append(
            {
                "job_id": job_id,
                "story_id": story_id,
                "error": error,
                "action": action,
                "story_mode": story_mode,
            }
        )

    def publish_summary_result(
        self,
        job_id: str,
        story_id: int | None,
        payload: StoryboardSummaryGenerateResponse,
        action: str,
        story_mode: str = "VIEWER",
    ) -> None:
        self.published_results.append(
            {
                "job_id": job_id,
                "story_id": story_id,
                "payload": payload,
                "action": action,
                "story_mode": story_mode,
            }
        )

    def publish_summary_failure(
        self,
        job_id: str,
        story_id: int | None,
        error,
        action: str = "GENERATE",
        story_mode: str = "VIEWER",
    ) -> None:
        self.published_failures.append(
            {
                "job_id": job_id,
                "story_id": story_id,
                "error": error,
                "action": action,
                "story_mode": story_mode,
            }
        )


def setup_function() -> None:
    settings.OPENAI_API_KEY = None
    settings.GEMINI_API_KEY = None


def test_handle_generate_message_publishes_completed_envelope() -> None:
    publisher = FakePublisher()
    body = """
    {
      "jobId": "job-generate-1",
      "jobType": "STORY",
      "storyId": 1,
      "payload": {
        "storyId": 1,
        "children": [{"name": "Haesol", "age": 7, "gender": "FEMALE"}],
        "companions": ["Mom", "Dad"],
        "travel": {
          "place": "Waikiki",
          "startDate": "2026-01-10",
          "endDate": "2026-01-14"
        },
        "photos": [
          {
            "photoId": 101,
            "s3Key": "stories/1/photos/101.png",
            "description": "Haesol put her feet in the ocean for the first time.",
            "hashtags": ["beach", "first_time"],
            "displayOrder": 1
          }
        ],
        "difficulty": "BEGINNER"
      }
    }
    """.encode("utf-8")

    handle_generate_message(body=body, publisher=publisher)

    assert not publisher.published_failures
    assert len(publisher.published_results) == 1
    published = publisher.published_results[0]
    assert published["job_id"] == "job-generate-1"
    assert published["story_id"] == 1
    assert published["action"] == "GENERATE"
    assert 10 <= published["payload"].pageCount <= 20
    assert published["payload"].usage.promptTemplateVersion == "storyboard_v3"


def test_handle_webtoon_generate_message_uses_webtoon_story_mode() -> None:
    publisher = FakePublisher()
    body = """
    {
      "jobId": "job-webtoon-generate-1",
      "jobType": "STORY",
      "storyMode": "WEBTOON",
      "storyId": 1,
      "payload": {
        "storyId": 1,
        "children": [{"name": "Haesol", "age": 7, "gender": "FEMALE"}],
        "companions": ["Mom", "Dad"],
        "travel": {
          "place": "Waikiki",
          "startDate": "2026-01-10",
          "endDate": "2026-01-14"
        },
        "photos": [
          {
            "photoId": 101,
            "s3Key": "stories/1/photos/101.png",
            "description": "Haesol put her feet in the ocean for the first time.",
            "hashtags": ["beach", "first_time"],
            "displayOrder": 1
          }
        ],
        "difficulty": "BEGINNER",
        "approvedSummary": {
          "title": "Haesol's Little Journey to Waikiki",
          "summary": "Haesol travels to Waikiki with her family. She wonders what makes the trip special. Small memories begin to connect. She learns that love makes the journey warm. The family shares a bright ending.",
          "summaryKo": "Haesol travels to Waikiki with her family.",
          "moralTheme": "Small loving moments become the heart of a family adventure.",
          "storyQuest": "Find what makes the family trip feel truly special.",
          "recurringMotif": "A gentle ribbon of sunlight.",
          "keyEmotionalBeats": [
            "The child arrives with a question.",
            "Joyful moments appear.",
            "Family memories connect."
          ]
        }
      }
    }
    """.encode("utf-8")

    handle_generate_message(body=body, publisher=publisher)

    assert not publisher.published_failures
    assert len(publisher.published_results) == 1
    published = publisher.published_results[0]
    assert published["job_id"] == "job-webtoon-generate-1"
    assert published["story_id"] == 1
    assert published["action"] == "GENERATE"
    assert published["story_mode"] == "WEBTOON"
    assert published["payload"].usage.promptTemplateVersion == "storyboard_webtoon_v1"
    assert all(hasattr(page, "charactersInScene") for page in published["payload"].pages)


def test_handle_regenerate_message_publishes_completed_envelope() -> None:
    publisher = FakePublisher()
    body = """
    {
      "jobId": "job-regenerate-1",
      "jobType": "STORY",
      "storyId": 1,
      "payload": {
        "storyId": 1,
        "originalRequest": {
          "storyId": 1,
          "children": [{"name": "Haesol", "age": 7, "gender": "FEMALE"}],
          "companions": ["Mom", "Dad"],
          "travel": {
            "place": "Waikiki",
            "startDate": "2026-01-10",
            "endDate": "2026-01-14"
          },
          "photos": [
            {
              "photoId": 101,
              "s3Key": "stories/1/photos/101.png",
              "description": "Haesol put her feet in the ocean for the first time.",
              "hashtags": ["beach", "first_time"],
              "displayOrder": 1
            }
          ],
          "difficulty": "BEGINNER"
        },
        "currentStoryboard": {
          "title": "Sample",
          "synopsis": "Sample synopsis",
          "moralTheme": "Kindness",
          "storyQuest": "Find courage",
          "recurringMotif": "A shy sunbeam",
          "pageCount": 1,
          "pageCountReason": "Sample",
          "readingLevel": {
            "basedOnAge": 7,
            "sentencesPerPage": "3-5",
            "wordsPerSentence": "8-16",
            "reason": "Sample"
          },
          "totalWordCount": 5,
          "pages": [
            {
              "pageNumber": 1,
              "sourcePhotoIds": [101],
              "sceneSummary": "Sample scene",
              "englishText": "Haesol smiled at the water.",
              "koreanText": "해솔은 물을 보며 웃었다.",
              "imagePrompt": "Sample image prompt",
              "sentences": [
                {
                  "sentenceOrder": 1,
                  "englishText": "Haesol smiled at the water.",
                  "koreanText": "해솔은 물을 보며 웃었다.",
                  "emotion": "HAPPY"
                }
              ],
              "sentenceCount": 1,
              "wordCount": 5
            }
          ],
          "usage": {
            "model": "local-storyboard-fallback",
            "inputTokens": 0,
            "outputTokens": 0,
            "totalTokens": 0,
            "costUsd": 0.0,
            "promptTemplateVersion": "storyboard_v2"
          }
        },
        "feedbackInstruction": "Make it feel more like a fairy tale."
      }
    }
    """.encode("utf-8")

    handle_regenerate_message(body=body, publisher=publisher)

    assert not publisher.published_failures
    assert len(publisher.published_results) == 1
    published = publisher.published_results[0]
    assert published["job_id"] == "job-regenerate-1"
    assert published["story_id"] == 1
    assert published["action"] == "REGENERATE"
    assert 10 <= published["payload"].pageCount <= 20


def test_handle_webtoon_summary_generate_message_uses_webtoon_summary_mode() -> None:
    publisher = FakePublisher()
    body = """
    {
      "jobId": "job-webtoon-summary-1",
      "jobType": "STORY_SUMMARY",
      "storyMode": "WEBTOON",
      "storyId": 1,
      "payload": {
        "storyId": 1,
        "children": [{"name": "Haesol", "age": 7, "gender": "FEMALE"}],
        "companions": ["Mom", "Dad"],
        "travel": {
          "place": "Waikiki",
          "startDate": "2026-01-10",
          "endDate": "2026-01-14"
        },
        "photos": [
          {
            "photoId": 101,
            "s3Key": "stories/1/photos/101.png",
            "description": "Haesol put her feet in the ocean for the first time.",
            "hashtags": ["beach", "first_time"],
            "displayOrder": 1
          }
        ],
        "difficulty": "BEGINNER"
      }
    }
    """.encode("utf-8")

    handle_summary_generate_message(body=body, publisher=publisher)

    assert not publisher.published_failures
    assert len(publisher.published_results) == 1
    published = publisher.published_results[0]
    assert published["job_id"] == "job-webtoon-summary-1"
    assert published["story_id"] == 1
    assert published["action"] == "GENERATE"
    assert published["story_mode"] == "WEBTOON"
    assert published["payload"].usage.promptTemplateVersion == "storyboard_summary_webtoon_v1"


def test_handle_webtoon_summary_regenerate_message_uses_webtoon_summary_mode() -> None:
    publisher = FakePublisher()
    body = """
    {
      "jobId": "job-webtoon-summary-regenerate-1",
      "jobType": "STORY_SUMMARY_REGENERATE",
      "storyMode": "WEBTOON",
      "storyId": 1,
      "payload": {
        "storyId": 1,
        "children": [{"name": "Haesol", "age": 7, "gender": "FEMALE"}],
        "companions": ["Mom", "Dad"],
        "travel": {
          "place": "Waikiki",
          "startDate": "2026-01-10",
          "endDate": "2026-01-14"
        },
        "photos": [
          {
            "photoId": 101,
            "s3Key": "stories/1/photos/101.png",
            "description": "Haesol put her feet in the ocean for the first time.",
            "hashtags": ["beach", "first_time"],
            "displayOrder": 1
          }
        ],
        "difficulty": "BEGINNER",
        "previousSummary": {
          "title": "Haesol's Little Journey to Waikiki",
          "summary": "Haesol travels to Waikiki with her family. She wonders what makes the trip special. Small memories begin to connect. She learns that love makes the journey warm. The family shares a bright ending.",
          "summaryKo": "Haesol travels to Waikiki with her family.",
          "moralTheme": "Small loving moments become the heart of a family adventure.",
          "storyQuest": "Find what makes the family trip feel truly special.",
          "recurringMotif": "A gentle ribbon of sunlight.",
          "keyEmotionalBeats": [
            "The child arrives with a question.",
            "Joyful moments appear.",
            "Family memories connect.",
            "The child understands the trip's warmth."
          ]
        },
        "userPrompt": "Make the summary more useful for webtoon dialogue beats."
      }
    }
    """.encode("utf-8")

    handle_summary_regenerate_message(body=body, publisher=publisher)

    assert not publisher.published_failures
    assert len(publisher.published_results) == 1
    published = publisher.published_results[0]
    assert published["job_id"] == "job-webtoon-summary-regenerate-1"
    assert published["story_id"] == 1
    assert published["action"] == "REGENERATE"
    assert published["story_mode"] == "WEBTOON"
    assert published["payload"].usage.promptTemplateVersion == "storyboard_summary_webtoon_v1"


def test_handle_webtoon_regenerate_message_uses_webtoon_story_mode() -> None:
    publisher = FakePublisher()
    body = """
    {
      "jobId": "job-webtoon-regenerate-1",
      "jobType": "STORY",
      "storyMode": "WEBTOON",
      "storyId": 1,
      "payload": {
        "storyId": 1,
        "originalRequest": {
          "storyId": 1,
          "children": [{"name": "Haesol", "age": 7, "gender": "FEMALE"}],
          "companions": ["Mom", "Dad"],
          "travel": {
            "place": "Waikiki",
            "startDate": "2026-01-10",
            "endDate": "2026-01-14"
          },
          "photos": [
            {
              "photoId": 101,
              "s3Key": "stories/1/photos/101.png",
              "description": "Haesol put her feet in the ocean for the first time.",
              "hashtags": ["beach", "first_time"],
              "displayOrder": 1
            }
          ],
          "difficulty": "BEGINNER"
        },
        "currentStoryboard": {
          "title": "Sample Webtoon",
          "synopsis": "Sample webtoon synopsis",
          "moralTheme": "Kindness",
          "storyQuest": "Find courage",
          "recurringMotif": "A shy sunbeam",
          "pageCount": 1,
          "pageCountReason": "Sample",
          "readingLevel": {
            "basedOnAge": 7,
            "sentencesPerPage": "3-5",
            "wordsPerSentence": "8-16",
            "reason": "Sample"
          },
          "totalWordCount": 12,
          "pages": [
            {
              "pageNumber": 1,
              "sourcePhotoIds": [101],
              "sceneSummary": "Sample scene",
              "englishText": "Haesol smiled. Mom waved. The water sparkled.",
              "koreanText": "Haesol smiled. Mom waved. The water sparkled.",
              "imagePrompt": "Sample webtoon image prompt",
              "charactersInScene": [
                {
                  "characterKey": "child:Haesol",
                  "sceneRole": "smiling at the water",
                  "expectedPosition": "center"
                }
              ],
              "sentences": [
                {
                  "sentenceOrder": 1,
                  "type": "NARRATION",
                  "speakerKey": "narrator",
                  "englishText": "Haesol smiled at the water.",
                  "koreanText": "Haesol smiled at the water.",
                  "emotion": "HAPPY"
                }
              ],
              "sentenceCount": 1,
              "wordCount": 5
            }
          ],
          "usage": {
            "model": "local-webtoon-storyboard-fallback",
            "inputTokens": 0,
            "outputTokens": 0,
            "totalTokens": 0,
            "costUsd": 0.0,
            "promptTemplateVersion": "storyboard_webtoon_v1"
          }
        },
        "feedbackInstruction": "Make the webtoon more dialogue-led."
      }
    }
    """.encode("utf-8")

    handle_regenerate_message(body=body, publisher=publisher)

    assert not publisher.published_failures
    assert len(publisher.published_results) == 1
    published = publisher.published_results[0]
    assert published["job_id"] == "job-webtoon-regenerate-1"
    assert published["story_id"] == 1
    assert published["action"] == "REGENERATE"
    assert published["story_mode"] == "WEBTOON"
    assert published["payload"].usage.promptTemplateVersion == "storyboard_webtoon_v1"
    assert all(hasattr(page, "charactersInScene") for page in published["payload"].pages)

