from app.consumers import storyboard_image_consumer
from app.consumers.storyboard_image_consumer import (
    handle_generate_batch_message,
    handle_generate_item_message,
    handle_regenerate_message,
)
from app.schemas.storyboard_image import (
    StoryboardImageGenerateResult,
    StoryboardImageUsage,
    StoryboardImageRegenerateResponse,
)


class FakeImagePublisher:
    def __init__(self) -> None:
        self.published_item_jobs: list[object] = []
        self.published_results: list[dict] = []
        self.published_failures: list[dict] = []

    def publish_generate_item_job(self, message) -> None:
        self.published_item_jobs.append(message)

    def publish_result(
        self,
        job_id: str,
        story_id: int,
        seed: int,
        result: StoryboardImageGenerateResult,
        action: str,
        story_mode: str = "VIEWER",
    ) -> None:
        self.published_results.append(
            {
                "job_id": job_id,
                "story_id": story_id,
                "seed": seed,
                "result": result,
                "action": action,
                "story_mode": story_mode,
            }
        )

    def publish_failure(
        self,
        job_id: str,
        story_id: int,
        error,
        action: str,
        page_number: int | None = None,
        story_mode: str = "VIEWER",
    ) -> None:
        self.published_failures.append(
            {
                "job_id": job_id,
                "story_id": story_id,
                "error": error,
                "action": action,
                "page_number": page_number,
                "story_mode": story_mode,
            }
        )


def _image_item_json() -> str:
    return """
      {
        "pageNumber": 1,
        "storyboard": {
          "title": "Sample Webtoon",
          "synopsis": "A small family trip becomes a brave memory."
        },
        "page": {
          "pageNumber": 1,
          "sceneSummary": "Youjin looks at the carousel.",
          "englishText": "Youjin smiled at the bright carousel.",
          "koreanText": "유진이는 밝은 회전목마를 보며 웃었어요.",
          "imagePrompt": "rough webtoon storyboard panel",
          "charactersInScene": [
            {
              "characterKey": "이유진",
              "sceneRole": "smiling at the carousel",
              "expectedPosition": "center"
            }
          ]
        },
        "children": [{"name": "이유진", "age": 5, "gender": "FEMALE"}],
        "companions": ["엄마", "아빠"],
        "referenceImageS3Keys": ["stories/test/2.jpg"]
      }
    """


def _result(page_number: int = 1) -> StoryboardImageGenerateResult:
    return StoryboardImageGenerateResult(
        pageNumber=page_number,
        imageUrl="https://example.com/storyboard.png",
        usage=StoryboardImageUsage(
            provider="local",
            model="test-model",
            imageCount=1,
            costUsd=0.0,
        ),
    )


def test_webtoon_image_batch_preserves_story_mode_on_item_jobs(monkeypatch) -> None:
    publisher = FakeImagePublisher()
    monkeypatch.setattr(
        storyboard_image_consumer,
        "ensure_storyboard_character_reference",
        lambda story_id, seed, items, character_source_image_urls, character_source_image_s3_keys: items,
    )
    body = f"""
    {{
      "jobId": "job-webtoon-image-1",
      "jobType": "STORYBOARD_IMAGE",
      "storyMode": "WEBTOON",
      "storyId": 1,
      "payload": {{
        "storyId": 1,
        "seed": 123,
        "items": [{_image_item_json()}]
      }}
    }}
    """.encode("utf-8")

    handle_generate_batch_message(body=body, publisher=publisher)

    assert len(publisher.published_item_jobs) == 1
    assert publisher.published_item_jobs[0].storyMode == "WEBTOON"


def test_webtoon_image_item_generation_uses_webtoon_mode(monkeypatch) -> None:
    publisher = FakeImagePublisher()
    captured: dict[str, object] = {}

    def fake_generate_storyboard_image_item(story_id, item, seed, output_version=None, webtoon_mode=False):
        captured["webtoon_mode"] = webtoon_mode
        return _result(item.pageNumber)

    monkeypatch.setattr(
        storyboard_image_consumer,
        "generate_storyboard_image_item",
        fake_generate_storyboard_image_item,
    )
    body = f"""
    {{
      "jobId": "job-webtoon-image-item-1",
      "jobType": "STORYBOARD_IMAGE",
      "storyMode": "WEBTOON",
      "storyId": 1,
      "payload": {{
        "seed": 123,
        "item": {_image_item_json()}
      }}
    }}
    """.encode("utf-8")

    handle_generate_item_message(body=body, publisher=publisher)

    assert captured["webtoon_mode"] is True
    assert publisher.published_results[0]["story_mode"] == "WEBTOON"


def test_webtoon_image_regenerate_uses_webtoon_service(monkeypatch) -> None:
    publisher = FakeImagePublisher()
    called: dict[str, bool] = {}

    def fake_regenerate_webtoon_storyboard_image(request):
        called["webtoon"] = True
        return StoryboardImageRegenerateResponse(
            storyId=request.storyId,
            seed=request.seed,
            outputVersion=request.outputVersion,
            result=_result(request.item.pageNumber),
        )

    monkeypatch.setattr(
        storyboard_image_consumer,
        "regenerate_webtoon_storyboard_image",
        fake_regenerate_webtoon_storyboard_image,
    )
    body = f"""
    {{
      "jobId": "job-webtoon-image-regenerate-1",
      "jobType": "STORYBOARD_IMAGE",
      "storyMode": "WEBTOON",
      "storyId": 1,
      "payload": {{
        "storyId": 1,
        "seed": 123,
        "outputVersion": 2,
        "userPrompt": "인물 위치를 더 웹툰 콘티처럼 정리해줘.",
        "item": {_image_item_json()}
      }}
    }}
    """.encode("utf-8")

    handle_regenerate_message(body=body, publisher=publisher)

    assert called["webtoon"] is True
    assert publisher.published_results[0]["action"] == "REGENERATE"
    assert publisher.published_results[0]["story_mode"] == "WEBTOON"
    assert publisher.published_results[0]["result"].pageNumber == 1
