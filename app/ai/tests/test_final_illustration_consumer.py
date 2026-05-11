from app.consumers import final_illustration_consumer
from app.consumers.final_illustration_consumer import (
    _create_layout_item_job,
    handle_layout_batch_message,
)
from app.schemas.final_illustration import (
    CharacterAnchorCandidate,
    FinalIllustrationLayoutAnalysisResponse,
    LayoutAnchor,
    LayoutBoundingBox,
)


class FakeFinalIllustrationPublisher:
    def __init__(self) -> None:
        self.published_layout_item_jobs: list[object] = []
        self.published_layout_results: list[dict] = []
        self.published_layout_failures: list[dict] = []

    def publish_layout_item_job(self, message) -> None:
        self.published_layout_item_jobs.append(message)

    def publish_layout_result(
        self,
        job_id: str,
        story_id: int,
        result: FinalIllustrationLayoutAnalysisResponse,
    ) -> None:
        self.published_layout_results.append(
            {
                "job_id": job_id,
                "story_id": story_id,
                "result": result,
            }
        )

    def publish_layout_failure(
        self,
        job_id: str,
        story_id: int,
        error,
        page_number: int | None = None,
    ) -> None:
        self.published_layout_failures.append(
            {
                "job_id": job_id,
                "story_id": story_id,
                "error": error,
                "page_number": page_number,
            }
        )


def _layout_item_json(page_number: int = 1) -> str:
    return f"""
      {{
        "pageNumber": {page_number},
        "imageUrl": "https://example.com/final-{page_number}.png",
        "sceneSummary": "Lina stands at the beach entrance.",
        "imagePrompt": "A sunny beach entrance with Lina.",
        "children": [{{"name": "Lina", "age": 7, "gender": "FEMALE"}}],
        "companions": ["mom"],
        "sentences": [
          {{
            "sentenceOrder": 1,
            "englishText": "Lina found the beach.",
            "koreanText": "리나는 해변을 찾았어요.",
            "speakerKey": "Lina"
          }}
        ]
      }}
    """


def _layout_result(page_number: int = 1) -> FinalIllustrationLayoutAnalysisResponse:
    return FinalIllustrationLayoutAnalysisResponse(
        pageNumber=page_number,
        model="gemini-3-flash-preview",
        characters=[
            CharacterAnchorCandidate(
                name="Lina",
                bbox=LayoutBoundingBox(x=0.3, y=0.4, width=0.2, height=0.3),
                anchor=LayoutAnchor(x=0.4, y=0.38),
                confidence=0.9,
            )
        ],
    )


def test_final_illustration_layout_batch_publishes_item_jobs() -> None:
    publisher = FakeFinalIllustrationPublisher()
    body = f"""
    {{
      "jobId": "job-layout-1",
      "jobType": "FINAL_ILLUSTRATION",
      "storyId": 101,
      "payload": {{
        "items": [
          {_layout_item_json(0)},
          {_layout_item_json(1)},
          {_layout_item_json(2)}
        ]
      }}
    }}
    """.encode("utf-8")

    handle_layout_batch_message(body=body, publisher=publisher)

    assert len(publisher.published_layout_item_jobs) == 2
    assert publisher.published_layout_item_jobs[0].jobId == "job-layout-1"
    assert publisher.published_layout_item_jobs[0].storyId == 101
    assert publisher.published_layout_item_jobs[0].payload.pageNumber == 1
    assert publisher.published_layout_item_jobs[1].payload.pageNumber == 2


def test_final_illustration_layout_item_publishes_analysis_result(monkeypatch) -> None:
    published_results: list[dict] = []
    monkeypatch.setattr(
        final_illustration_consumer,
        "analyze_final_illustration_layout",
        lambda request: _layout_result(request.pageNumber),
    )
    monkeypatch.setattr(
        final_illustration_consumer,
        "_publish_layout_result",
        lambda message, result: published_results.append(
            {
                "job_id": message.jobId,
                "story_id": message.storyId,
                "result": result,
            }
        ) or True,
    )
    body = f"""
    {{
      "jobId": "job-layout-item-1",
      "jobType": "FINAL_ILLUSTRATION",
      "storyId": 101,
      "payload": {_layout_item_json(10)}
    }}
    """.encode("utf-8")

    job = _create_layout_item_job(body)
    result = job.task()
    should_ack = job.on_success(result)

    assert should_ack is True
    assert published_results[0]["job_id"] == "job-layout-item-1"
    assert published_results[0]["story_id"] == 101
    assert published_results[0]["result"].pageNumber == 10
