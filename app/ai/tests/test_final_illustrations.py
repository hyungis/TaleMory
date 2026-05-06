import app.services.final_illustration_service as final_illustration_service
from app.schemas.final_illustration import (
    FinalIllustrationContext,
    FinalIllustrationGenerateItemRequest,
    FinalIllustrationPageInput,
    FinalIllustrationRenderOptions,
)
from app.services.final_illustration_service import (
    _build_final_prompt,
    _build_replicate_input,
    _build_revise_item,
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
