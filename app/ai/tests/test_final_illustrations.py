import app.services.final_illustration_service as final_illustration_service
import app.services.final_illustration_layout_service as final_illustration_layout_service
from app.core.config import settings
from app.schemas.final_illustration import (
    FinalIllustrationContext,
    FinalIllustrationGenerateItemRequest,
    FinalIllustrationLayoutAnalysisRequest,
    FinalIllustrationPageInput,
    FinalIllustrationRenderOptions,
    LayoutSentenceInput,
)
from app.services.final_illustration_layout_service import (
    _build_layout_prompt,
    _layout_response_schema,
    analyze_final_illustration_layout,
)
from app.services.final_illustration_service import (
    _build_final_prompt,
    _build_replicate_input,
    _build_revise_item,
    _extract_s3_key_from_url,
    _resolve_reference_string,
    _upload_and_resolve_url,
)


def _sample_item() -> FinalIllustrationGenerateItemRequest:
    return FinalIllustrationGenerateItemRequest(
        pageNumber=1,
        storyboard=FinalIllustrationContext(
            title="Beach Day",
            synopsis="A child arrives at a warm beach with family.",
        ),
        page=FinalIllustrationPageInput(
            pageNumber=1,
            sceneSummary="Lina arrives at the beach.",
            englishText="Lina arrived at the beach.",
            koreanText="리나는 해변에 도착했다.",
            imagePrompt="A child arriving at a sunny beach with family.",
        ),
        children=[{"name": "Lina", "age": 7, "gender": "FEMALE"}],
        companions=["mom", "dad"],
        roughStoryboardImageUrl="https://example.com/rough.png",
        currentIllustrationImageS3Key="stories/1/final-illustration/1/v1.png",
        stylePrompt="Soft watercolor picture-book illustration with warm sunlight.",
        additionalInstruction="Keep Lina centered.",
    )


def test_build_final_prompt_prioritizes_image_one_and_style_prompt() -> None:
    prompt = _build_final_prompt(_sample_item())

    assert prompt.startswith("Style prompt:\nSoft watercolor picture-book illustration with warm sunlight.")
    assert "Follow image 1 as closely as possible without changing the scene" in prompt
    assert "Apply only the rendering style from the style prompt." in prompt
    assert "Absolutely no visible text anywhere in the image." in prompt
    assert "Scene summary: Lina arrives at the beach." in prompt
    assert "Scene intent: A child arriving at a sunny beach with family." in prompt


def test_build_replicate_input_uses_only_primary_reference_image() -> None:
    payload = _build_replicate_input(
        item=_sample_item(),
        seed=1234,
        render_options=FinalIllustrationRenderOptions(),
        final_prompt="test prompt",
    )

    assert payload["prompt"] == "test prompt"
    assert payload["images"] == ["https://example.com/rough.png"]
    assert payload["seed"] == 1234


def test_extract_s3_key_from_private_s3_url(monkeypatch) -> None:
    monkeypatch.setattr(settings, "STORYBOARD_IMAGE_S3_BUCKET", "s210-iportfolio-dev")

    key = _extract_s3_key_from_url(
        "https://s210-iportfolio-dev.s3.ap-northeast-2.amazonaws.com/stories/1/storyboard-image/0/v1.png"
    )

    assert key == "stories/1/storyboard-image/0/v1.png"


def test_resolve_reference_string_converts_s3_url_to_data_uri(monkeypatch) -> None:
    monkeypatch.setattr(settings, "STORYBOARD_IMAGE_S3_BUCKET", "s210-iportfolio-dev")
    monkeypatch.setattr(settings, "AWS_S3_ENV_PREFIX", "local")
    monkeypatch.setattr(
        final_illustration_service,
        "_download_reference_image_from_s3",
        lambda key: ("image/png", b"png") if key == "local/stories/1/storyboard-image/0/v1.png" else None,
    )

    reference = _resolve_reference_string(
        "https://s210-iportfolio-dev.s3.ap-northeast-2.amazonaws.com/stories/1/storyboard-image/0/v1.png",
        None,
    )

    assert reference == "data:image/png;base64,cG5n"


def test_build_revise_item_uses_current_illustration_as_primary_image() -> None:
    item = _build_revise_item(_sample_item(), "Make the sky softer.")

    assert item.roughStoryboardImageUrl is None
    assert item.roughStoryboardImageS3Key == "stories/1/final-illustration/1/v1.png"
    assert item.additionalInstruction is not None
    assert "Keep Lina centered." in item.additionalInstruction
    assert "User revision request: Make the sky softer." in item.additionalInstruction


def test_upload_path_uses_output_version(monkeypatch) -> None:
    item = _sample_item().model_copy(update={"outputVersion": 3})
    monkeypatch.setattr(final_illustration_service, "_has_s3_upload_config", lambda: False)

    url = _upload_and_resolve_url(1, item, b"png")

    assert url.endswith("stories/1/final-illustration/1/v3.png")


def _sample_layout_request() -> FinalIllustrationLayoutAnalysisRequest:
    return FinalIllustrationLayoutAnalysisRequest(
        pageNumber=1,
        imageUrl="https://example.com/final.png",
        sceneSummary="Lina stands near the beach entrance.",
        imagePrompt="A sunny beach entrance with Lina and her parents.",
        children=[{"name": "Lina", "age": 7, "gender": "FEMALE"}],
        companions=["mom", "dad"],
        sentences=[
            LayoutSentenceInput(
                sentenceOrder=1,
                englishText="Lina found the beach.",
                koreanText="Lina found the beach.",
                speakerKey="Lina",
            )
        ],
    )


def test_build_layout_prompt_requests_speaker_head_anchor_only() -> None:
    prompt = _build_layout_prompt(_sample_layout_request())

    assert "Use normalized coordinates from 0 to 1" in prompt
    assert "Only find character anchors for characters who are speakers" in prompt
    assert "Speaker keys to locate: Lina" in prompt
    assert "just above the top of the character's head" in prompt
    assert "Do not return speech bubble coordinates." in prompt
    assert "Lina" in prompt
    assert "Lina found the beach." in prompt


def test_layout_response_schema_contains_structured_bbox_fields() -> None:
    schema = _layout_response_schema()

    character = schema["properties"]["characters"]["items"]

    assert "bbox" in character["properties"]
    assert character["properties"]["bbox"]["required"] == ["x", "y", "width", "height"]
    assert "speechBubbles" not in schema["properties"]


def test_analyze_final_illustration_layout_parses_gemini_json(monkeypatch) -> None:
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "FINAL_ILLUSTRATION_LAYOUT_MODEL", "gemini-3-flash-preview")
    monkeypatch.setattr(
        final_illustration_layout_service,
        "_load_layout_image",
        lambda request_model: ("image/png", b"png"),
    )
    monkeypatch.setattr(
        final_illustration_layout_service,
        "_call_gemini_layout_api",
        lambda request_model, model: {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": """
                                {
                                  "pageNumber": 1,
                                  "characters": [
                                    {
                                      "name": "Lina",
                                      "bbox": {"x": 0.3, "y": 0.4, "width": 0.2, "height": 0.3},
                                      "anchor": {"x": 0.4, "y": 0.55},
                                      "confidence": 0.82
                                    }
                                  ]
                                }
                                """
                            }
                        ]
                    }
                }
            ]
        },
    )

    result = analyze_final_illustration_layout(_sample_layout_request())

    assert result.model == "gemini-3-flash-preview"
    assert result.characters[0].name == "Lina"
