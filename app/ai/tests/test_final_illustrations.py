from app.schemas.final_illustration import (
    FinalIllustrationContext,
    FinalIllustrationGenerateItemRequest,
    FinalIllustrationPageInput,
    FinalIllustrationRenderOptions,
)
from app.services.final_illustration_service import _build_final_prompt, _build_replicate_input


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
            koreanText="리나는 해변에 도착했어요.",
            imagePrompt="A child arriving at a sunny beach with family.",
        ),
        children=[{"name": "Lina", "age": 7, "gender": "FEMALE"}],
        companions=["mom", "dad"],
        roughStoryboardImageUrl="https://example.com/rough.png",
        styleImageUrls=["https://example.com/style.png"],
        stylePrompt="Soft watercolor picture-book illustration with warm sunlight.",
        additionalInstruction="Keep Lina centered.",
    )


def test_build_final_prompt_separates_composition_and_style_roles() -> None:
    prompt = _build_final_prompt(_sample_item())

    assert "The rough storyboard image is the composition blueprint." in prompt
    assert "Do not redesign the scene from scratch." in prompt
    assert "Style direction prompt: Soft watercolor picture-book illustration with warm sunlight." in prompt
    assert "Additional instruction: Keep Lina centered." in prompt


def test_build_replicate_input_orders_references_with_rough_first() -> None:
    payload = _build_replicate_input(
        item=_sample_item(),
        seed=1234,
        render_options=FinalIllustrationRenderOptions(),
        final_prompt="test prompt",
    )

    assert payload["prompt"] == "test prompt"
    assert payload["images"][0] == "https://example.com/rough.png"
    assert payload["images"][1] == "https://example.com/style.png"
    assert payload["seed"] == 1234
