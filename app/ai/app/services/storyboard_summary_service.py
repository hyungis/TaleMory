import json
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)
from app.schemas.storyboard import UsageInfo
from app.schemas.storyboard_summary import (
    StoryboardSummaryDraft,
    StoryboardSummaryGenerateRequest,
    StoryboardSummaryGenerateResponse,
    StoryboardSummaryRegenerateRequest,
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
    use_openai = bool(settings.OPENAI_API_KEY)
    logger.info(
        "[SUMMARY:GEN] service entry — useOpenAI=%s, photos=%d, children=%d, place=%s",
        use_openai, len(request.photos), len(request.children), request.travel.place,
    )
    if use_openai:
        return _generate_with_openai(request)
    return _generate_locally(request)


def regenerate_storyboard_summary(
    request: StoryboardSummaryRegenerateRequest,
) -> StoryboardSummaryGenerateResponse:
    use_openai = bool(settings.OPENAI_API_KEY)
    logger.info(
        "[SUMMARY:REGEN] service entry — useOpenAI=%s, userPromptLen=%d",
        use_openai, len(request.userPrompt or ""),
    )
    if use_openai:
        return _regenerate_with_openai(request)
    return _generate_locally(request)


def _generate_with_openai(
    request: StoryboardSummaryGenerateRequest,
) -> StoryboardSummaryGenerateResponse:
    return _request_summary_with_openai(
        input_content=_build_openai_input_content(request),
        schema_name="storyboard_summary_generation_response",
        error_label="generation",
    )


def _regenerate_with_openai(
    request: StoryboardSummaryRegenerateRequest,
) -> StoryboardSummaryGenerateResponse:
    return _request_summary_with_openai(
        input_content=_build_openai_regenerate_input_content(request),
        schema_name="storyboard_summary_regeneration_response",
        error_label="regeneration",
    )


def _request_summary_with_openai(
    *,
    input_content: list[dict[str, str]],
    schema_name: str,
    error_label: str,
) -> StoryboardSummaryGenerateResponse:
    try:
        from openai import OpenAI
        from openai import OpenAIError
    except ImportError as exc:
        raise RuntimeError("openai package is not installed") from exc

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    schema = _to_openai_strict_json_schema(StoryboardSummaryGenerateResponse.model_json_schema())
    request_args = {
        "model": settings.STORYBOARD_SUMMARY_MODEL,
        "input": [
            {"role": "system", "content": STORYBOARD_SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": input_content},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": schema_name,
                "strict": True,
                "schema": schema,
            }
        },
    }
    reasoning = _build_reasoning_config()
    if reasoning is not None:
        request_args["reasoning"] = reasoning

    logger.info(
        "[SUMMARY] OpenAI call start — model=%s, contentBlocks=%d, label=%s",
        settings.STORYBOARD_SUMMARY_MODEL, len(input_content), error_label,
    )
    try:
        response = client.responses.create(**request_args)
    except OpenAIError as exc:
        logger.exception("[SUMMARY] OpenAI call failed (%s)", error_label)
        raise ValueError(f"OpenAI storyboard summary {error_label} failed: {exc}") from exc

    parsed = StoryboardSummaryGenerateResponse.model_validate_json(response.output_text)
    parsed_with_usage = _apply_usage(parsed, response.usage)
    logger.info(
        "[SUMMARY] OpenAI call done — label=%s, summaryKoLen=%d, inputTok=%s, outputTok=%s, costUsd=%s",
        error_label, len(parsed_with_usage.summaryKo),
        parsed_with_usage.usage.inputTokens, parsed_with_usage.usage.outputTokens,
        parsed_with_usage.usage.costUsd,
    )
    return parsed_with_usage


def _apply_usage(
    parsed: StoryboardSummaryGenerateResponse,
    usage: object,
) -> StoryboardSummaryGenerateResponse:
    token_usage = _extract_token_usage(usage)
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
    return _append_images(content, request.photos)


def _build_openai_regenerate_input_content(
    request: StoryboardSummaryRegenerateRequest,
) -> list[dict[str, str]]:
    content: list[dict[str, str]] = [
        {
            "type": "input_text",
            "text": (
                "Revise the previous story summary according to the user's prompt. "
                "Use the previous summary as the starting point. "
                "Preserve unchanged parts when the user did not ask to change them. "
                "Keep the output compact and emotionally coherent."
            ),
        },
        {
            "type": "input_text",
            "text": (
                "USER REVISION PROMPT - HIGHEST PRIORITY:\n"
                f"{request.userPrompt.strip()}"
            ),
        },
        {
            "type": "input_text",
            "text": (
                "PREVIOUS SUMMARY - STARTING POINT:\n"
                f"{json.dumps(request.previousSummary.model_dump(mode='json'), ensure_ascii=False)}"
            ),
        },
        {
            "type": "input_text",
            "text": (
                "ORIGINAL TRIP INPUT - GROUNDING DATA:\n"
                f"{json.dumps(_to_generate_request(request).model_dump(mode='json'), ensure_ascii=False)}"
            ),
        },
    ]
    return _append_images(content, request.photos)


def _append_images(
    content: list[dict[str, str]],
    photos: list,
) -> list[dict[str, str]]:
    if not FIXED_USE_VISION:
        return content

    for photo in sorted(photos, key=lambda item: item.displayOrder):
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


def _to_generate_request(
    request: StoryboardSummaryRegenerateRequest,
) -> StoryboardSummaryGenerateRequest:
    base = request.model_dump(mode="json")
    base.pop("userPrompt", None)
    base.pop("previousSummary", None)
    return StoryboardSummaryGenerateRequest.model_validate(base)


def _generate_locally(
    request: StoryboardSummaryGenerateRequest | StoryboardSummaryRegenerateRequest,
) -> StoryboardSummaryGenerateResponse:
    if isinstance(request, StoryboardSummaryRegenerateRequest):
        draft = _revise_locally(request.previousSummary, request.userPrompt)
    else:
        draft = _create_local_draft(request)

    return StoryboardSummaryGenerateResponse(
        **draft.model_dump(mode="json"),
        usage=UsageInfo(
            model="local-storyboard-summary-fallback",
            inputTokens=0,
            outputTokens=0,
            totalTokens=0,
            costUsd=0.0,
            promptTemplateVersion=STORYBOARD_SUMMARY_PROMPT_TEMPLATE_VERSION,
        ),
    )


def _create_local_draft(request: StoryboardSummaryGenerateRequest) -> StoryboardSummaryDraft:
    sorted_photos = sorted(request.photos, key=lambda photo: photo.displayOrder)
    child = request.children[0]
    companion_text = _format_companions(request.companions)
    place = request.travel.place
    first_photo = sorted_photos[0].description
    last_photo = sorted_photos[-1].description

    return StoryboardSummaryDraft(
        title=f"{child.name}'s Little Journey to {place}",
        summary=(
            f"{child.name} travels to {place} with {companion_text}, wondering what makes the trip feel truly special. "
            f"The early memories, including {first_photo}, fill the child with curiosity but do not answer that feeling yet. "
            "As the family keeps moving through the trip, small moments begin to connect like quiet clues. "
            "The child notices that warmth appears again and again in ordinary scenes, not only in big highlights. "
            f"By the time the family reaches moments like {last_photo}, the child begins to understand the pattern. "
            f"In the end, {child.name} realizes that the trip's magic grows from shared love, attention, and brave little steps together."
        ),
        summaryKo=(
            f"{child.name}은(는) {companion_text}와 함께 {place}로 여행을 떠나며, 이 여행을 정말 특별하게 만드는 것이 무엇인지 궁금해합니다. "
            f"{first_photo} 같은 여행의 첫 장면들은 아이의 마음을 호기심으로 채우지만, 그 답을 바로 알려 주지는 않습니다. "
            "가족이 함께 여행을 이어 가는 동안, 작은 순간들은 조용한 단서처럼 하나씩 이어지기 시작합니다. "
            "아이는 커다란 하이라이트뿐 아니라 평범한 장면들 속에서도 따뜻함이 반복된다는 것을 느끼게 됩니다. "
            f"{last_photo} 같은 순간에 이르러, 아이는 이 여행을 관통하는 어떤 의미를 조금씩 이해하기 시작합니다. "
            f"마지막에는 {child.name}이(가) 여행의 마법이 가족이 함께 나누는 사랑과 관심, 그리고 작은 용기 속에서 자란다는 것을 깨닫게 됩니다."
        ),
        moralTheme="Small loving moments become the heart of a family adventure.",
        storyQuest="Find what makes the family trip feel truly special.",
        recurringMotif="A gentle ribbon of sunlight that appears whenever the child notices meaning in a moment.",
        keyEmotionalBeats=[
            "The child arrives with excitement but also a quiet emotional question.",
            "Joyful moments appear, but the answer still feels incomplete.",
            "Ordinary family memories begin to connect into a deeper pattern.",
            "The child understands that love and attention give the trip its magic.",
        ],
    )


def _revise_locally(previous: StoryboardSummaryDraft, user_prompt: str) -> StoryboardSummaryDraft:
    prompt = user_prompt.strip()
    if not prompt:
        return previous

    lowered = prompt.lower()
    title = previous.title
    if "title" in lowered or "제목" in prompt:
        title = f"{previous.title} Again"

    return StoryboardSummaryDraft(
        title=title,
        summary=previous.summary,
        summaryKo=previous.summaryKo,
        moralTheme=previous.moralTheme,
        storyQuest=previous.storyQuest,
        recurringMotif=previous.recurringMotif,
        keyEmotionalBeats=previous.keyEmotionalBeats,
    )


def _format_companions(companions: list[str]) -> str:
    if not companions:
        return "family"
    if len(companions) == 1:
        return companions[0]
    if len(companions) == 2:
        return f"{companions[0]} and {companions[1]}"
    return ", ".join(companions[:-1]) + f", and {companions[-1]}"
