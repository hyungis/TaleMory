import json

from app.core.config import settings
from app.schemas.storyboard import UsageInfo
from app.schemas.storyboard_summary import (
    StoryboardSummaryGenerateRequest,
    StoryboardSummaryGenerateResponse,
)
from app.services.storyboard_prompt import (
    STORYBOARD_SUMMARY_PROMPT_TEMPLATE_VERSION,
    STORYBOARD_SUMMARY_SYSTEM_PROMPT,
)
from app.services.storyboard_service import (
    FIXED_USE_VISION,
    FIXED_VISION_DETAIL,
    _extract_token_usage,
    _resolve_openai_image_url,
    _to_openai_strict_json_schema,
)


def generate_storyboard_summary(
    request: StoryboardSummaryGenerateRequest,
) -> StoryboardSummaryGenerateResponse:
    if settings.OPENAI_API_KEY:
        return _generate_with_openai(request)
    return _generate_locally(request)


def _generate_with_openai(
    request: StoryboardSummaryGenerateRequest,
) -> StoryboardSummaryGenerateResponse:
    try:
        from openai import OpenAI
        from openai import OpenAIError
    except ImportError as exc:
        raise RuntimeError("openai package is not installed") from exc

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    schema = _to_openai_strict_json_schema(StoryboardSummaryGenerateResponse.model_json_schema())
    input_content = _build_openai_input_content(request)

    request_args = {
        "model": settings.STORYBOARD_SUMMARY_MODEL,
        "input": [
            {"role": "system", "content": STORYBOARD_SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": input_content},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "storyboard_summary_generation_response",
                "strict": True,
                "schema": schema,
            }
        },
    }
    reasoning = _build_reasoning_config()
    if reasoning is not None:
        request_args["reasoning"] = reasoning

    try:
        response = client.responses.create(**request_args)
    except OpenAIError as exc:
        raise ValueError(f"OpenAI storyboard summary generation failed: {exc}") from exc

    parsed = StoryboardSummaryGenerateResponse.model_validate_json(response.output_text)
    token_usage = _extract_token_usage(response.usage)
    parsed.usage.model = settings.STORYBOARD_SUMMARY_MODEL
    parsed.usage.inputTokens = token_usage["input_tokens"]
    parsed.usage.outputTokens = token_usage["output_tokens"]
    parsed.usage.totalTokens = token_usage["total_tokens"]
    parsed.usage.costUsd = _estimate_summary_cost_usd(
        input_tokens=token_usage["input_tokens"],
        output_tokens=token_usage["output_tokens"],
    )
    parsed.usage.promptTemplateVersion = STORYBOARD_SUMMARY_PROMPT_TEMPLATE_VERSION
    return parsed


def _build_openai_input_content(
    request: StoryboardSummaryGenerateRequest,
) -> list[dict[str, str]]:
    content: list[dict[str, str]] = [
        {
            "type": "input_text",
            "text": (
                "Create one concise summary plan for a later multi-page storybook. "
                "Do not write page text. Keep the output compact and emotionally coherent."
            ),
        },
        {
            "type": "input_text",
            "text": json.dumps(request.model_dump(mode="json"), ensure_ascii=False),
        },
    ]
    if not FIXED_USE_VISION:
        return content

    for photo in sorted(request.photos, key=lambda item: item.displayOrder):
        image_url = _resolve_openai_image_url(photo)
        if not image_url:
            continue
        content.append(
            {
                "type": "input_image",
                "image_url": image_url,
                "detail": FIXED_VISION_DETAIL,
            }
        )
    return content


def _build_reasoning_config() -> dict[str, str] | None:
    effort = settings.STORYBOARD_SUMMARY_REASONING_EFFORT.strip()
    if not effort:
        return None
    if not settings.STORYBOARD_SUMMARY_MODEL.startswith("gpt-5"):
        return None
    return {"effort": effort}


def _estimate_summary_cost_usd(input_tokens: int | None, output_tokens: int | None) -> float | None:
    if input_tokens is None or output_tokens is None:
        return None
    input_cost = input_tokens * settings.STORYBOARD_SUMMARY_INPUT_COST_PER_1M / 1_000_000
    output_cost = output_tokens * settings.STORYBOARD_SUMMARY_OUTPUT_COST_PER_1M / 1_000_000
    return round(input_cost + output_cost, 6)


def _generate_locally(
    request: StoryboardSummaryGenerateRequest,
) -> StoryboardSummaryGenerateResponse:
    sorted_photos = sorted(request.photos, key=lambda photo: photo.displayOrder)
    child = request.children[0]
    companion_text = _format_companions(request.companions)
    place = request.travel.place
    first_photo = sorted_photos[0].description
    last_photo = sorted_photos[-1].description

    title = f"{child.name}'s Little Journey to {place}"
    summary = (
        f"{child.name} travels to {place} with {companion_text}, wondering what makes the trip feel truly special. "
        f"The early memories, including {first_photo}, fill the child with curiosity but do not answer that feeling yet. "
        f"As the family keeps moving through the trip, small moments begin to connect like quiet clues. "
        f"The child notices that warmth appears again and again in ordinary scenes, not only in big highlights. "
        f"By the time the family reaches moments like {last_photo}, the child begins to understand the pattern. "
        f"In the end, {child.name} realizes that the trip's magic grows from shared love, attention, and brave little steps together."
    )
    summary_ko = (
        f"{child.name}은 {companion_text}와 함께 {place}로 여행을 떠나며, 이 여행을 정말 특별하게 만드는 것이 무엇인지 궁금해합니다. "
        f"처음의 추억들, 이를테면 {first_photo} 같은 순간들은 아이의 마음을 호기심으로 채우지만 그 답을 바로 알려주지는 않습니다. "
        f"가족이 여행을 이어 가는 동안, 작은 순간들은 조용한 단서처럼 하나씩 이어지기 시작합니다. "
        f"아이는 특별한 하이라이트뿐 아니라 평범한 장면들 속에서도 따뜻함이 반복해서 나타난다는 것을 조금씩 느끼게 됩니다. "
        f"{last_photo} 같은 후반의 순간들에 이르러, 아이는 이 여행을 관통하는 어떤 패턴을 이해하기 시작합니다. "
        f"마침내 {child.name}은 여행의 마법이란 가족이 함께 나누는 사랑과 관심, 그리고 작은 용기 있는 한 걸음들 속에서 자라난다는 것을 깨닫게 됩니다."
    )
    return StoryboardSummaryGenerateResponse(
        title=title,
        summary=summary,
        summaryKo=summary_ko,
        moralTheme="Small loving moments become the heart of a family adventure.",
        storyQuest="Find what makes the family trip feel truly special.",
        recurringMotif="A gentle ribbon of sunlight that appears whenever the child notices meaning in a moment.",
        keyEmotionalBeats=[
            "The child arrives with excitement but also a quiet emotional question.",
            "Joyful moments appear, but the answer still feels incomplete.",
            "Ordinary family memories begin to connect into a deeper pattern.",
            "The child understands that love and attention give the trip its magic.",
        ],
        usage=UsageInfo(
            model="local-storyboard-summary-fallback",
            inputTokens=0,
            outputTokens=0,
            totalTokens=0,
            costUsd=0.0,
            promptTemplateVersion=STORYBOARD_SUMMARY_PROMPT_TEMPLATE_VERSION,
        ),
    )


def _format_companions(companions: list[str]) -> str:
    if not companions:
        return "family"
    if len(companions) == 1:
        return companions[0]
    if len(companions) == 2:
        return f"{companions[0]} and {companions[1]}"
    return ", ".join(companions[:-1]) + f", and {companions[-1]}"
