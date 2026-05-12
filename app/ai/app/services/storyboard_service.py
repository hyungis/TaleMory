import json
import base64
import logging
import mimetypes
import re
from functools import lru_cache
from itertools import cycle, islice
from urllib import error as url_error
from urllib import parse as url_parse
from urllib import request as url_request

import boto3

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.schemas.storyboard import (
    ApprovedStorySummary,
    PhotoInput,
    ReadingLevel,
    StoryboardGenerateRequest,
    StoryboardGenerateResponse,
    StoryboardPage,
    StoryboardRegenerateRequest,
    StorySentence,
    UsageInfo,
    WebtoonCharacterInScene,
    WebtoonStoryboardGenerateResponse,
    WebtoonStoryboardPage,
    WebtoonStoryboardRegenerateRequest,
    WebtoonStorySentence,
)
from app.services.storyboard_prompt import (
    STORYBOARD_PROMPT_TEMPLATE_VERSION,
    STORYBOARD_SYSTEM_PROMPT,
    WEBTOON_STORYBOARD_PROMPT_TEMPLATE_VERSION,
    WEBTOON_STORYBOARD_SYSTEM_PROMPT,
)

FIXED_PAGE_MIN = 10
FIXED_PAGE_MAX = 20
FIXED_MAGIC_LEVEL = "FANTASY"
FIXED_USE_VISION = True
FIXED_VISION_DETAIL = "low"


def generate_storyboard(request: StoryboardGenerateRequest) -> StoryboardGenerateResponse:
    use_gemini = _use_gemini_storyboard_model(settings.STORYBOARD_MODEL)
    use_openai = bool(settings.OPENAI_API_KEY)
    logger.info(
        "[STORY:GEN] service entry - provider=%s, photos=%d, children=%d, place=%s",
        _storyboard_provider_label(use_gemini, use_openai), len(request.photos), len(request.children), request.travel.place,
    )
    if use_gemini:
        return _generate_with_gemini(request)
    if use_openai:
        return _generate_with_openai(request)
    return _generate_locally(request)


def generate_webtoon_storyboard(request: StoryboardGenerateRequest) -> WebtoonStoryboardGenerateResponse:
    use_gemini = _use_gemini_storyboard_model(settings.WEBTOON_STORYBOARD_MODEL)
    use_openai = bool(settings.OPENAI_API_KEY)
    logger.info(
        "[STORY:WEBTOON:GEN] service entry - provider=%s, photos=%d, children=%d, place=%s",
        _storyboard_provider_label(use_gemini, use_openai), len(request.photos), len(request.children), request.travel.place,
    )
    if use_gemini:
        return _generate_webtoon_with_gemini(request)
    if use_openai:
        return _generate_webtoon_with_openai(request)
    return _generate_webtoon_locally(request)


def regenerate_storyboard(request: StoryboardRegenerateRequest) -> StoryboardGenerateResponse:
    use_gemini = _use_gemini_storyboard_model(settings.STORYBOARD_MODEL)
    use_openai = bool(settings.OPENAI_API_KEY)
    logger.info(
        "[STORY:REGEN] service entry - provider=%s, feedbackLen=%d",
        _storyboard_provider_label(use_gemini, use_openai), len(request.feedbackInstruction or ""),
    )
    if use_gemini:
        return _regenerate_with_gemini(request)
    if use_openai:
        return _regenerate_with_openai(request)
    return _generate_locally(_build_regenerate_fallback_request(request))


def regenerate_webtoon_storyboard(request: WebtoonStoryboardRegenerateRequest) -> WebtoonStoryboardGenerateResponse:
    use_gemini = _use_gemini_storyboard_model(settings.WEBTOON_STORYBOARD_MODEL)
    use_openai = bool(settings.OPENAI_API_KEY)
    logger.info(
        "[STORY:WEBTOON:REGEN] service entry - provider=%s, feedbackLen=%d",
        _storyboard_provider_label(use_gemini, use_openai), len(request.feedbackInstruction or ""),
    )
    if use_gemini:
        return _regenerate_webtoon_with_gemini(request)
    if use_openai:
        return _regenerate_webtoon_with_openai(request)
    return _generate_webtoon_locally(_build_webtoon_regenerate_fallback_request(request))


def _use_gemini_storyboard_model(model: str) -> bool:
    return model.startswith("gemini") and bool(settings.GEMINI_API_KEY)


def _storyboard_provider_label(use_gemini: bool, use_openai: bool) -> str:
    if use_gemini:
        return "gemini"
    if use_openai:
        return "openai"
    return "local"


def _generate_with_gemini(request: StoryboardGenerateRequest) -> StoryboardGenerateResponse:
    payload = request.model_dump(mode="json")
    input_content = _build_openai_input_content(request, payload, include_images=False)
    response_json = _call_gemini_storyboard_api(
        model=settings.STORYBOARD_MODEL,
        system_prompt=STORYBOARD_SYSTEM_PROMPT,
        input_content=input_content,
        response_schema=StoryboardGenerateResponse.model_json_schema(),
    )
    parsed = StoryboardGenerateResponse.model_validate_json(_extract_gemini_text(response_json))
    _reconcile_derived_counts(parsed)
    _apply_gemini_usage(parsed.usage, response_json, STORYBOARD_PROMPT_TEMPLATE_VERSION, settings.STORYBOARD_MODEL)
    return parsed


def _generate_webtoon_with_gemini(request: StoryboardGenerateRequest) -> WebtoonStoryboardGenerateResponse:
    payload = request.model_dump(mode="json")
    input_content = _build_openai_webtoon_input_content(request, payload, include_images=True)
    response_json = _call_gemini_storyboard_api(
        model=settings.WEBTOON_STORYBOARD_MODEL,
        system_prompt=WEBTOON_STORYBOARD_SYSTEM_PROMPT,
        input_content=input_content,
        response_schema=WebtoonStoryboardGenerateResponse.model_json_schema(),
    )
    parsed = WebtoonStoryboardGenerateResponse.model_validate_json(_extract_gemini_text(response_json))
    _reconcile_webtoon_derived_counts(parsed)
    _apply_gemini_usage(parsed.usage, response_json, WEBTOON_STORYBOARD_PROMPT_TEMPLATE_VERSION, settings.WEBTOON_STORYBOARD_MODEL)
    return parsed


def _regenerate_with_gemini(request: StoryboardRegenerateRequest) -> StoryboardGenerateResponse:
    input_content = _build_openai_regenerate_input_content(request, include_images=False)
    response_json = _call_gemini_storyboard_api(
        model=settings.STORYBOARD_MODEL,
        system_prompt=STORYBOARD_SYSTEM_PROMPT,
        input_content=input_content,
        response_schema=StoryboardGenerateResponse.model_json_schema(),
    )
    parsed = StoryboardGenerateResponse.model_validate_json(_extract_gemini_text(response_json))
    _reconcile_derived_counts(parsed)
    _apply_gemini_usage(parsed.usage, response_json, STORYBOARD_PROMPT_TEMPLATE_VERSION, settings.STORYBOARD_MODEL)
    return parsed


def _regenerate_webtoon_with_gemini(request: WebtoonStoryboardRegenerateRequest) -> WebtoonStoryboardGenerateResponse:
    input_content = _build_openai_webtoon_regenerate_input_content(request, include_images=True)
    response_json = _call_gemini_storyboard_api(
        model=settings.WEBTOON_STORYBOARD_MODEL,
        system_prompt=WEBTOON_STORYBOARD_SYSTEM_PROMPT,
        input_content=input_content,
        response_schema=WebtoonStoryboardGenerateResponse.model_json_schema(),
    )
    parsed = WebtoonStoryboardGenerateResponse.model_validate_json(_extract_gemini_text(response_json))
    _reconcile_webtoon_derived_counts(parsed)
    _apply_gemini_usage(parsed.usage, response_json, WEBTOON_STORYBOARD_PROMPT_TEMPLATE_VERSION, settings.WEBTOON_STORYBOARD_MODEL)
    return parsed


def _generate_webtoon_with_openai(request: StoryboardGenerateRequest) -> WebtoonStoryboardGenerateResponse:
    try:
        from openai import OpenAI
        from openai import OpenAIError
    except ImportError as exc:
        raise RuntimeError("openai package is not installed") from exc

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    schema = _to_openai_strict_json_schema(WebtoonStoryboardGenerateResponse.model_json_schema())
    payload = request.model_dump(mode="json")
    input_content = _build_openai_webtoon_input_content(request, payload)
    logger.info(
        "[STORY:WEBTOON:GEN] OpenAI call start - model=%s, contentBlocks=%d",
        settings.WEBTOON_STORYBOARD_MODEL, len(input_content),
    )

    try:
        response = client.responses.create(
            model=settings.WEBTOON_STORYBOARD_MODEL,
            input=[
                {"role": "system", "content": WEBTOON_STORYBOARD_SYSTEM_PROMPT},
                {"role": "user", "content": input_content},
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "webtoon_storyboard_generation_response",
                    "strict": True,
                    "schema": schema,
                }
            },
        )
    except OpenAIError as exc:
        logger.exception("[STORY:WEBTOON:GEN] OpenAI call failed")
        raise ValueError(f"OpenAI webtoon storyboard generation failed: {exc}") from exc

    parsed = WebtoonStoryboardGenerateResponse.model_validate_json(response.output_text)
    _reconcile_webtoon_derived_counts(parsed)
    token_usage = _extract_token_usage(response.usage)
    parsed.usage.model = settings.WEBTOON_STORYBOARD_MODEL
    parsed.usage.inputTokens = token_usage["input_tokens"]
    parsed.usage.outputTokens = token_usage["output_tokens"]
    parsed.usage.totalTokens = token_usage["total_tokens"]
    parsed.usage.costUsd = _estimate_cost_usd(
        input_tokens=token_usage["input_tokens"],
        output_tokens=token_usage["output_tokens"],
    )
    parsed.usage.promptTemplateVersion = WEBTOON_STORYBOARD_PROMPT_TEMPLATE_VERSION
    logger.info(
        "[STORY:WEBTOON:GEN] OpenAI call done - pages=%d, totalWords=%d, inputTok=%s, outputTok=%s, costUsd=%s",
        len(parsed.pages), parsed.totalWordCount,
        token_usage["input_tokens"], token_usage["output_tokens"], parsed.usage.costUsd,
    )
    return parsed


def _generate_with_openai(request: StoryboardGenerateRequest) -> StoryboardGenerateResponse:
    try:
        from openai import OpenAI
        from openai import OpenAIError
    except ImportError as exc:
        raise RuntimeError("openai package is not installed") from exc

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    schema = _to_openai_strict_json_schema(StoryboardGenerateResponse.model_json_schema())
    payload = request.model_dump(mode="json")
    input_content = _build_openai_input_content(request, payload)
    logger.info(
        "[STORY:GEN] OpenAI call start - model=%s, contentBlocks=%d",
        settings.STORYBOARD_MODEL, len(input_content),
    )

    try:
        response = client.responses.create(
            model=settings.STORYBOARD_MODEL,
            input=[
                {"role": "system", "content": STORYBOARD_SYSTEM_PROMPT},
                {"role": "user", "content": input_content},
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "storyboard_generation_response",
                    "strict": True,
                    "schema": schema,
                }
            },
        )
    except OpenAIError as exc:
        logger.exception("[STORY:GEN] OpenAI call failed")
        raise ValueError(f"OpenAI storyboard generation failed: {exc}") from exc

    parsed = StoryboardGenerateResponse.model_validate_json(response.output_text)
    _reconcile_derived_counts(parsed)
    token_usage = _extract_token_usage(response.usage)
    parsed.usage.model = settings.STORYBOARD_MODEL
    parsed.usage.inputTokens = token_usage["input_tokens"]
    parsed.usage.outputTokens = token_usage["output_tokens"]
    parsed.usage.totalTokens = token_usage["total_tokens"]
    parsed.usage.costUsd = _estimate_cost_usd(
        input_tokens=token_usage["input_tokens"],
        output_tokens=token_usage["output_tokens"],
    )
    parsed.usage.promptTemplateVersion = STORYBOARD_PROMPT_TEMPLATE_VERSION
    logger.info(
        "[STORY:GEN] OpenAI call done - pages=%d, totalWords=%d, inputTok=%s, outputTok=%s, costUsd=%s",
        len(parsed.pages), parsed.totalWordCount,
        token_usage["input_tokens"], token_usage["output_tokens"], parsed.usage.costUsd,
    )
    return parsed


def _regenerate_webtoon_with_openai(request: WebtoonStoryboardRegenerateRequest) -> WebtoonStoryboardGenerateResponse:
    try:
        from openai import OpenAI
        from openai import OpenAIError
    except ImportError as exc:
        raise RuntimeError("openai package is not installed") from exc

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    schema = _to_openai_strict_json_schema(WebtoonStoryboardGenerateResponse.model_json_schema())
    input_content = _build_openai_webtoon_regenerate_input_content(request)

    try:
        response = client.responses.create(
            model=settings.WEBTOON_STORYBOARD_MODEL,
            input=[
                {"role": "system", "content": WEBTOON_STORYBOARD_SYSTEM_PROMPT},
                {"role": "user", "content": input_content},
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "webtoon_storyboard_regeneration_response",
                    "strict": True,
                    "schema": schema,
                }
            },
        )
    except OpenAIError as exc:
        raise ValueError(f"OpenAI webtoon storyboard regeneration failed: {exc}") from exc

    parsed = WebtoonStoryboardGenerateResponse.model_validate_json(response.output_text)
    _reconcile_webtoon_derived_counts(parsed)
    token_usage = _extract_token_usage(response.usage)
    parsed.usage.model = settings.WEBTOON_STORYBOARD_MODEL
    parsed.usage.inputTokens = token_usage["input_tokens"]
    parsed.usage.outputTokens = token_usage["output_tokens"]
    parsed.usage.totalTokens = token_usage["total_tokens"]
    parsed.usage.costUsd = _estimate_cost_usd(
        input_tokens=token_usage["input_tokens"],
        output_tokens=token_usage["output_tokens"],
    )
    parsed.usage.promptTemplateVersion = WEBTOON_STORYBOARD_PROMPT_TEMPLATE_VERSION
    return parsed


def _regenerate_with_openai(request: StoryboardRegenerateRequest) -> StoryboardGenerateResponse:
    try:
        from openai import OpenAI
        from openai import OpenAIError
    except ImportError as exc:
        raise RuntimeError("openai package is not installed") from exc

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    schema = _to_openai_strict_json_schema(StoryboardGenerateResponse.model_json_schema())
    input_content = _build_openai_regenerate_input_content(request)

    try:
        response = client.responses.create(
            model=settings.STORYBOARD_MODEL,
            input=[
                {"role": "system", "content": STORYBOARD_SYSTEM_PROMPT},
                {"role": "user", "content": input_content},
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "storyboard_regeneration_response",
                    "strict": True,
                    "schema": schema,
                }
            },
        )
    except OpenAIError as exc:
        raise ValueError(f"OpenAI storyboard regeneration failed: {exc}") from exc

    parsed = StoryboardGenerateResponse.model_validate_json(response.output_text)
    _reconcile_derived_counts(parsed)
    token_usage = _extract_token_usage(response.usage)
    parsed.usage.model = settings.STORYBOARD_MODEL
    parsed.usage.inputTokens = token_usage["input_tokens"]
    parsed.usage.outputTokens = token_usage["output_tokens"]
    parsed.usage.totalTokens = token_usage["total_tokens"]
    parsed.usage.costUsd = _estimate_cost_usd(
        input_tokens=token_usage["input_tokens"],
        output_tokens=token_usage["output_tokens"],
    )
    parsed.usage.promptTemplateVersion = STORYBOARD_PROMPT_TEMPLATE_VERSION
    return parsed


def _build_openai_input_content(
    request: StoryboardGenerateRequest,
    payload: dict,
    include_images: bool = True,
) -> list[dict[str, str]]:
    photo_count = len(request.photos)
    min_pages = FIXED_PAGE_MIN
    max_pages = FIXED_PAGE_MAX
    page_directive = (
        f"Produce between {min_pages} and {max_pages} pages (inclusive). "
        f"There are {photo_count} source photo(s). "
        f"If {photo_count} is less than {min_pages}, you MUST add storybook bridge pages "
        "(opening, emotional transitions, fairy-tale-device beats, ending) so pageCount reaches "
        f"at least {min_pages}. Pages without a specific source photo must set sourcePhotoIds "
        "to an empty list [] and still belong to the unified story arc."
    )
    content: list[dict[str, str]] = [
        {"type": "input_text", "text": page_directive},
        *_approved_summary_input_blocks(request.approvedSummary),
        {
            "type": "input_text",
            "text": json.dumps(payload, ensure_ascii=False),
        },
    ]
    if not include_images or not FIXED_USE_VISION:
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


def _build_openai_webtoon_input_content(
    request: StoryboardGenerateRequest,
    payload: dict,
    include_images: bool = True,
) -> list[dict[str, str]]:
    character_keys = _webtoon_character_keys(request)
    character_directive = {
        "availableCharacters": character_keys,
        "speakerRules": {
            "dialogueSpeakerKeys": [item["characterKey"] for item in character_keys if item["characterKey"] != "narrator"],
            "narrationSpeakerKey": "narrator",
        },
    }
    webtoon_directive = (
        "Generate a WEBTOON storyboard for the same story creation flow. "
        "Make the script dialogue-led while preserving children's storybook warmth. "
        "Use only the provided availableCharacters keys for speakerKey and charactersInScene. "
        "Do not show every available character on every page; include only the 1-2 visible characters "
        "that the page illustration actually needs, and reserve full-family staging for group or payoff moments. "
        "DIALOGUE should be frequent and short. NARRATION should be sparse and only bridge the scene. "
        "Each page must include charactersInScene with sceneRole and expectedPosition for later image generation "
        "and final illustration coordinate extraction."
    )
    content = _build_openai_input_content(request, payload, include_images=include_images)
    content.insert(1, {"type": "input_text", "text": webtoon_directive})
    content.insert(
        2,
        {
            "type": "input_text",
            "text": "WEBTOON CHARACTER KEYS:\n" + json.dumps(character_directive, ensure_ascii=False),
        },
    )
    return content


def _build_openai_regenerate_input_content(
    request: StoryboardRegenerateRequest,
    include_images: bool = True,
) -> list[dict[str, str]]:
    original_request = request.originalRequest.model_copy(deep=True)
    if request.storyId is not None:
        original_request.storyId = request.storyId

    payload = original_request.model_dump(mode="json")
    page_directive = _page_directive_for_request(original_request)
    regenerate_instruction = (
        "Regenerate the storyboard using the original request, the current storyboard, and the "
        "user's feedback. Keep the same output schema as storyboard generation. Improve the story "
        "according to the feedback instead of lightly paraphrasing the current storyboard."
    )
    feedback_instruction = (
        "USER FEEDBACK - HIGH PRIORITY:\n"
        f"{request.feedbackInstruction.strip()}\n\n"
        "You must prioritize this explicit user feedback over the current storyboard's existing tone, "
        "motif, and wording. Treat the current storyboard as something to revise, not something to preserve.\n"
        "If the feedback conflicts with soft stylistic preferences, previous story choices, or the prior draft's "
        "structure, follow the user's feedback.\n"
        "If the feedback conflicts with hard safety constraints or strict output-schema requirements, keep those "
        "hard constraints, but still satisfy the user's intent as closely as possible.\n"
        "If the feedback asks for stronger fantasy or a new story element, do not ignore it. Reflect it as strongly "
        "as possible within the allowed storybook tone."
    )
    content: list[dict[str, str]] = [
        {"type": "input_text", "text": page_directive},
        *_approved_summary_input_blocks(original_request.approvedSummary),
        {"type": "input_text", "text": regenerate_instruction},
        {"type": "input_text", "text": feedback_instruction},
        {
            "type": "input_text",
            "text": json.dumps(
                {
                    "originalRequest": payload,
                    "currentStoryboard": request.currentStoryboard.model_dump(mode="json"),
                    "feedbackInstruction": request.feedbackInstruction,
                },
                ensure_ascii=False,
            ),
        },
    ]
    if not include_images or not FIXED_USE_VISION:
        return content

    for photo in sorted(original_request.photos, key=lambda item: item.displayOrder):
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


def _build_openai_webtoon_regenerate_input_content(
    request: WebtoonStoryboardRegenerateRequest,
    include_images: bool = True,
) -> list[dict[str, str]]:
    original_request = request.originalRequest.model_copy(deep=True)
    if request.storyId is not None:
        original_request.storyId = request.storyId

    payload = original_request.model_dump(mode="json")
    content = _build_openai_webtoon_input_content(original_request, payload, include_images=include_images)
    content.extend(
        [
            {
                "type": "input_text",
                "text": (
                    "Regenerate the WEBTOON storyboard using the original request, "
                    "the current webtoon storyboard, and the user's feedback. "
                    "Keep the WEBTOON output schema. Improve the story according "
                    "to the feedback instead of lightly paraphrasing the current storyboard."
                ),
            },
            {
                "type": "input_text",
                "text": (
                    "USER FEEDBACK - HIGH PRIORITY:\n"
                    f"{request.feedbackInstruction.strip()}\n\n"
                    "Prioritize this feedback while preserving hard webtoon schema rules, "
                    "approvedSummary direction, character keys, and child-friendly tone."
                ),
            },
            {
                "type": "input_text",
                "text": (
                    "CURRENT WEBTOON STORYBOARD TO REVISE:\n"
                    f"{json.dumps(request.currentStoryboard.model_dump(mode='json'), ensure_ascii=False)}"
                ),
            },
        ]
    )
    return content


def _page_directive_for_request(request: StoryboardGenerateRequest) -> str:
    photo_count = len(request.photos)
    min_pages = FIXED_PAGE_MIN
    max_pages = FIXED_PAGE_MAX
    return (
        f"Produce between {min_pages} and {max_pages} pages (inclusive). "
        f"There are {photo_count} source photo(s). "
        f"If {photo_count} is less than {min_pages}, you MUST add storybook bridge pages "
        "(opening, emotional transitions, fairy-tale-device beats, ending) so pageCount reaches "
        f"at least {min_pages}. Pages without a specific source photo must set sourcePhotoIds "
        "to an empty list [] and still belong to the unified story arc."
    )


def _approved_summary_input_blocks(
    approved_summary: ApprovedStorySummary | None,
) -> list[dict[str, str]]:
    if approved_summary is None:
        return []
    return [
        {
            "type": "input_text",
            "text": (
                "APPROVED SUMMARY - FIXED TOP-LEVEL STORY PLAN:\n"
                "Preserve this emotional arc, moral theme, story quest, recurring motif, "
                "and key emotional beats while expanding into pages."
            ),
        },
        {
            "type": "input_text",
            "text": json.dumps(approved_summary.model_dump(mode="json"), ensure_ascii=False),
        },
    ]


def _reconcile_derived_counts(parsed: StoryboardGenerateResponse) -> None:
    for page_index, page in enumerate(parsed.pages, start=1):
        page.pageNumber = page_index
        for sentence_index, sentence in enumerate(page.sentences, start=1):
            sentence.sentenceOrder = sentence_index
        page.sentenceCount = len(page.sentences)
        page.wordCount = _count_words(page.englishText)
    parsed.pageCount = len(parsed.pages)
    parsed.totalWordCount = sum(page.wordCount for page in parsed.pages)


def _reconcile_webtoon_derived_counts(parsed: WebtoonStoryboardGenerateResponse) -> None:
    for page_index, page in enumerate(parsed.pages, start=1):
        page.pageNumber = page_index
        for sentence_index, sentence in enumerate(page.sentences, start=1):
            sentence.sentenceOrder = sentence_index
            if sentence.speakerKey == "narrator":
                sentence.type = "NARRATION"
            if sentence.type == "NARRATION":
                sentence.speakerKey = "narrator"
            if sentence.type == "DIALOGUE":
                _normalize_webtoon_dialogue_sentence(sentence)
        page.sentenceCount = len(page.sentences)
        page.englishText = " ".join(sentence.englishText.strip() for sentence in page.sentences).strip()
        page.koreanText = " ".join(sentence.koreanText.strip() for sentence in page.sentences).strip()
        page.wordCount = _count_words(page.englishText)
    parsed.pageCount = len(parsed.pages)
    parsed.totalWordCount = sum(page.wordCount for page in parsed.pages)


_ENGLISH_SPEAKER_TAG_RE = re.compile(
    r"\s*,?\s*(?:she|he|they|mommy|mom|dad|daddy|mother|father|[A-Z][A-Za-z]*)\s+"
    r"(?:says?|said|asks?|asked|whispers?|whispered|shouts?|shouted|cries?|cried|replies?|replied)\.?\s*$",
    re.IGNORECASE,
)
_KOREAN_SPEAKER_TAG_RE = re.compile(
    r"\s*(?:라고|하고)?\s*(?:그녀|그|그는|그녀는|엄마|아빠|[가-힣A-Za-z]+(?:이|가|은|는)?)\s*"
    r"(?:말한다|말했다|말해요|말했어요|말하죠|묻는다|물었다|물어요|외친다|외쳤다|외쳐요|"
    r"속삭인다|속삭였다|대답한다|대답했다)\.?\s*$"
)
_DOUBLE_QUOTED_TEXT_RE = re.compile(r"[\"“]([^\"“”]+)[\"”]")
_SINGLE_QUOTED_TEXT_RE = re.compile(r"'([^']+)'")


def _normalize_webtoon_dialogue_sentence(sentence: WebtoonStorySentence) -> None:
    sentence.englishText = _spoken_text_only(sentence.englishText, korean=False)
    sentence.koreanText = _spoken_text_only(sentence.koreanText, korean=True)


def _spoken_text_only(text: str, *, korean: bool) -> str:
    stripped = text.strip()
    quoted = _DOUBLE_QUOTED_TEXT_RE.search(stripped) or _SINGLE_QUOTED_TEXT_RE.search(stripped)
    if quoted:
        return quoted.group(1).strip()
    pattern = _KOREAN_SPEAKER_TAG_RE if korean else _ENGLISH_SPEAKER_TAG_RE
    return pattern.sub("", stripped).strip()


def _call_gemini_storyboard_api(
    *,
    model: str,
    system_prompt: str,
    input_content: list[dict[str, str]],
    response_schema: dict,
) -> dict:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    api_url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={url_parse.quote(settings.GEMINI_API_KEY)}"
    )
    payload = {
        "systemInstruction": {
            "parts": [{"text": system_prompt}],
        },
        "contents": [
            {
                "role": "user",
                "parts": _build_gemini_parts(input_content),
            }
        ],
        "generationConfig": {
            "maxOutputTokens": 65536,
            "responseMimeType": "application/json",
            "responseJsonSchema": _to_gemini_json_schema(response_schema),
            "thinkingConfig": {
                "thinkingBudget": 0,
            },
        },
    }
    req = url_request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    logger.info(
        "[STORY:GEMINI] call start - model=%s, contentBlocks=%d",
        settings.STORYBOARD_MODEL, len(input_content),
    )
    try:
        with url_request.urlopen(req, timeout=180) as response:
            response_json = json.loads(response.read().decode("utf-8"))
    except url_error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        logger.exception("[STORY:GEMINI] call failed")
        raise ValueError(f"Gemini storyboard generation failed: {exc.code} {body}") from exc
    except url_error.URLError as exc:
        logger.exception("[STORY:GEMINI] network error")
        raise RuntimeError(f"Gemini storyboard generation network error: {exc.reason}") from exc

    usage = _extract_gemini_token_usage(response_json)
    logger.info(
        "[STORY:GEMINI] call done - inputTok=%s, outputTok=%s, totalTok=%s",
        usage["input_tokens"], usage["output_tokens"], usage["total_tokens"],
    )
    return response_json


def _build_gemini_parts(input_content: list[dict[str, str]]) -> list[dict]:
    parts: list[dict] = []
    for block in input_content:
        block_type = block.get("type")
        if block_type == "input_text":
            parts.append({"text": block.get("text", "")})
            continue
        if block_type == "input_image":
            image_part = _build_gemini_image_part(block.get("image_url", ""))
            if image_part is not None:
                parts.append(image_part)
    return parts


def _build_gemini_image_part(image_ref: str) -> dict | None:
    if not image_ref:
        return None
    if image_ref.startswith("data:"):
        header, encoded = image_ref.split(",", 1)
        mime_type = header.removeprefix("data:").split(";", 1)[0] or "image/png"
        return {"inlineData": {"mimeType": mime_type, "data": encoded}}

    try:
        with url_request.urlopen(image_ref, timeout=30) as response:
            raw_bytes = response.read()
            mime_type = response.headers.get_content_type()
            if mime_type == "application/octet-stream":
                mime_type = mimetypes.guess_type(image_ref)[0] or "image/png"
    except Exception:
        logger.warning("[STORY:GEMINI] skipped unreadable image reference")
        return None
    return {
        "inlineData": {
            "mimeType": mime_type,
            "data": base64.b64encode(raw_bytes).decode("ascii"),
        }
    }


def _extract_gemini_text(response_json: dict) -> str:
    text_parts: list[str] = []
    for candidate in response_json.get("candidates", []):
        content = candidate.get("content", {})
        for part in content.get("parts", []):
            text_value = part.get("text")
            if text_value:
                text_parts.append(text_value)
    text = "".join(text_parts).strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text.startswith("json"):
            text = text[4:].strip()
    if not text:
        raise ValueError(f"Gemini storyboard generation returned empty text: {_gemini_empty_text_debug(response_json)}")
    return text


def _gemini_empty_text_debug(response_json: dict) -> str:
    candidates = response_json.get("candidates", [])
    finish_reasons = [
        candidate.get("finishReason") or candidate.get("finish_reason")
        for candidate in candidates
    ]
    safety_ratings = [
        candidate.get("safetyRatings") or candidate.get("safety_ratings")
        for candidate in candidates
    ]
    prompt_feedback = response_json.get("promptFeedback") or response_json.get("prompt_feedback")
    usage = response_json.get("usageMetadata") or response_json.get("usage_metadata")
    return (
        f"finishReasons={finish_reasons}, "
        f"promptFeedback={prompt_feedback}, "
        f"safetyRatings={safety_ratings}, "
        f"usageMetadata={usage}"
    )


def _apply_gemini_usage(usage: UsageInfo, response_json: dict, prompt_template_version: str, model: str) -> None:
    token_usage = _extract_gemini_token_usage(response_json)
    usage.model = model
    usage.inputTokens = token_usage["input_tokens"]
    usage.outputTokens = token_usage["output_tokens"]
    usage.totalTokens = token_usage["total_tokens"]
    usage.costUsd = _estimate_cost_usd(
        input_tokens=token_usage["input_tokens"],
        output_tokens=token_usage["output_tokens"],
    )
    usage.promptTemplateVersion = prompt_template_version


def _extract_gemini_token_usage(response_json: dict) -> dict[str, int | None]:
    usage_metadata = response_json.get("usageMetadata", {})
    input_tokens = _optional_int(usage_metadata.get("promptTokenCount"))
    output_tokens = _optional_int(usage_metadata.get("candidatesTokenCount"))
    total_tokens = _optional_int(usage_metadata.get("totalTokenCount"))
    if total_tokens is None and input_tokens is not None and output_tokens is not None:
        total_tokens = input_tokens + output_tokens
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }


def _optional_int(value: object) -> int | None:
    return int(value) if value is not None else None


def _to_gemini_json_schema(schema: dict) -> dict:
    raw = json.loads(json.dumps(schema))
    definitions = raw.pop("$defs", {})
    return _normalize_gemini_schema(raw, definitions)


def _normalize_gemini_schema(node: object, definitions: dict) -> object:
    if isinstance(node, list):
        return [_normalize_gemini_schema(item, definitions) for item in node]
    if not isinstance(node, dict):
        return node

    if "$ref" in node:
        ref_name = node["$ref"].rsplit("/", 1)[-1]
        ref_schema = definitions.get(ref_name, {})
        merged = json.loads(json.dumps(ref_schema))
        merged.update({key: value for key, value in node.items() if key != "$ref"})
        return _normalize_gemini_schema(merged, definitions)

    any_of = node.pop("anyOf", None)
    if isinstance(any_of, list):
        non_null = [item for item in any_of if item.get("type") != "null"]
        has_null = len(non_null) != len(any_of)
        if len(non_null) == 1:
            normalized = _normalize_gemini_schema(non_null[0], definitions)
            if isinstance(normalized, dict) and has_null:
                normalized_type = normalized.get("type")
                if isinstance(normalized_type, str):
                    normalized["type"] = [normalized_type, "null"]
            node.update(normalized)

    for key in (
        "$defs",
        "default",
        "description",
        "examples",
        "maxLength",
        "minLength",
        "title",
    ):
        node.pop(key, None)

    for key, value in list(node.items()):
        if key == "properties" and isinstance(value, dict):
            node[key] = {
                property_name: _normalize_gemini_schema(property_schema, definitions)
                for property_name, property_schema in value.items()
            }
            continue
        node[key] = _normalize_gemini_schema(value, definitions)
    return node


def _count_words(text: str) -> int:
    if not text:
        return 0
    cleaned = text.replace('"', " ").replace("'", " ")
    for ch in ".,!?;:()[]":
        cleaned = cleaned.replace(ch, " ")
    return len([token for token in cleaned.split() if token])


def _to_openai_strict_json_schema(schema: dict) -> dict:
    strict_schema = json.loads(json.dumps(schema))
    _mark_objects_strict(strict_schema)
    return strict_schema


def _extract_token_usage(usage: object) -> dict[str, int | None]:
    input_tokens = _get_usage_value(usage, "input_tokens")
    output_tokens = _get_usage_value(usage, "output_tokens")
    total_tokens = _get_usage_value(usage, "total_tokens")
    if total_tokens is None and input_tokens is not None and output_tokens is not None:
        total_tokens = input_tokens + output_tokens
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }


def _get_usage_value(usage: object, key: str) -> int | None:
    if usage is None:
        return None
    if isinstance(usage, dict):
        value = usage.get(key)
    else:
        value = getattr(usage, key, None)
    return int(value) if value is not None else None


def _estimate_cost_usd(input_tokens: int | None, output_tokens: int | None) -> float | None:
    if input_tokens is None or output_tokens is None:
        return None
    input_cost = input_tokens * settings.STORYBOARD_INPUT_COST_PER_1M / 1_000_000
    output_cost = output_tokens * settings.STORYBOARD_OUTPUT_COST_PER_1M / 1_000_000
    return round(input_cost + output_cost, 6)


def _resolve_openai_image_url(photo: PhotoInput) -> str | None:
    if photo.s3Key:
        return _build_data_url_from_s3(photo.s3Key)
    return photo.imageUrl


def _build_data_url_from_s3(s3_key: str) -> str:
    image_bytes = _download_photo_bytes_from_s3(s3_key)
    mime_type = mimetypes.guess_type(s3_key)[0] or "image/png"
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


@lru_cache
def _get_s3_client():
    client_kwargs: dict[str, object] = {}
    if settings.AWS_REGION:
        client_kwargs["region_name"] = settings.AWS_REGION
    if settings.AWS_ACCESS_KEY_ID:
        client_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
    if settings.AWS_SECRET_ACCESS_KEY:
        client_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    return boto3.client("s3", **client_kwargs)


def _download_photo_bytes_from_s3(s3_key: str) -> bytes:
    if not settings.AWS_S3_BUCKET:
        raise RuntimeError("AWS_S3_BUCKET is not configured")

    client = _get_s3_client()
    try:
        response = client.get_object(Bucket=settings.AWS_S3_BUCKET, Key=s3_key)
        return response["Body"].read()
    except Exception as exc:
        raise RuntimeError(f"Failed to load source photo from S3: {s3_key}") from exc


def _mark_objects_strict(node: object) -> None:
    if isinstance(node, dict):
        node.pop("default", None)
        node.pop("title", None)
        if node.get("type") == "object" or "properties" in node:
            properties = node.get("properties", {})
            node["additionalProperties"] = False
            node["required"] = list(properties.keys())
        for key, value in node.items():
            if key == "properties" and isinstance(value, dict):
                for property_schema in value.values():
                    _mark_objects_strict(property_schema)
                continue
            _mark_objects_strict(value)
    elif isinstance(node, list):
        for item in node:
            _mark_objects_strict(item)


def _generate_locally(request: StoryboardGenerateRequest) -> StoryboardGenerateResponse:
    sorted_photos = sorted(request.photos, key=lambda photo: photo.displayOrder)
    youngest_age = min(child.age for child in request.children)
    reading_level = _reading_level_for_age(youngest_age)
    page_count = _choose_page_count(
        photo_count=len(sorted_photos),
        min_pages=FIXED_PAGE_MIN,
        max_pages=FIXED_PAGE_MAX,
    )
    photo_groups = _group_photos(sorted_photos, page_count)
    main_child = request.children[0].name
    companion_text = _format_companions(request.companions)
    premise = _build_local_premise(main_child, companion_text, request.travel.place, sorted_photos, request.approvedSummary)

    pages: list[StoryboardPage] = []
    for page_number, photos in enumerate(photo_groups, start=1):
        primary_photo = photos[0]
        source_photo_ids = [photo.photoId for photo in photos]
        scene_summary = _scene_summary(page_number, page_count, primary_photo.description, request.travel.place)
        sentences = _sentences_for_page(
            page_number=page_number,
            page_count=page_count,
            child_name=main_child,
            companion_text=companion_text,
            photo_description=primary_photo.description,
            travel_place=request.travel.place,
            magic_level=FIXED_MAGIC_LEVEL,
            premise=premise,
        )
        english_text = " ".join(sentence.englishText for sentence in sentences)
        korean_text = " ".join(sentence.koreanText for sentence in sentences)
        word_count = len(english_text.replace('"', "").replace(".", "").split())
        pages.append(
            StoryboardPage(
                pageNumber=page_number,
                sourcePhotoIds=source_photo_ids,
                sceneSummary=scene_summary,
                englishText=english_text,
                koreanText=korean_text,
                imagePrompt=_image_prompt(
                    child_name=main_child,
                    scene_summary=scene_summary,
                    travel_place=request.travel.place,
                    hashtags=primary_photo.hashtags,
                ),
                sentences=sentences,
                sentenceCount=len(sentences),
                wordCount=word_count,
            )
        )

    title = request.approvedSummary.title if request.approvedSummary else f"{main_child}'s Little Trip to {request.travel.place}"
    synopsis = (
        request.approvedSummary.summary
        if request.approvedSummary
        else (
            f"{main_child} visits {request.travel.place} with {companion_text}. "
            "A shy sunbeam seems to guide the family from one small brave step to the next, "
            "teaching that courage grows through kindness and love."
        )
    )
    response = StoryboardGenerateResponse(
        title=title,
        synopsis=synopsis,
        moralTheme=(
            request.approvedSummary.moralTheme
            if request.approvedSummary
            else "Courage grows through small kind steps."
        ),
        storyQuest=(
            request.approvedSummary.storyQuest
            if request.approvedSummary
            else "Find where courage hides during the family trip."
        ),
        recurringMotif=(
            request.approvedSummary.recurringMotif
            if request.approvedSummary
            else "A shy sunbeam that appears whenever the child takes a brave or kind step."
        ),
        pageCount=len(pages),
        pageCountReason=(
            f"{len(sorted_photos)} photos were arranged into {len(pages)} pages "
            "by preserving photo order and grouping related moments."
        ),
        readingLevel=reading_level,
        totalWordCount=sum(page.wordCount for page in pages),
        pages=pages,
        usage=UsageInfo(
            model="local-storyboard-fallback",
            inputTokens=0,
            outputTokens=0,
            totalTokens=0,
            costUsd=0.0,
            promptTemplateVersion=STORYBOARD_PROMPT_TEMPLATE_VERSION,
        ),
    )
    _reconcile_derived_counts(response)
    return response


def _generate_webtoon_locally(request: StoryboardGenerateRequest) -> WebtoonStoryboardGenerateResponse:
    base = _generate_locally(request)
    character_keys = _webtoon_character_keys(request)
    dialogue_keys = [item["characterKey"] for item in character_keys if item["characterKey"] != "narrator"]
    fallback_speaker = dialogue_keys[0] if dialogue_keys else "character"
    companion_speaker = dialogue_keys[1] if len(dialogue_keys) > 1 else fallback_speaker

    pages: list[WebtoonStoryboardPage] = []
    for page in base.pages:
        primary_speaker = fallback_speaker if page.pageNumber % 2 else companion_speaker
        secondary_speaker = companion_speaker if primary_speaker == fallback_speaker else fallback_speaker
        characters_in_scene = [
            WebtoonCharacterInScene(
                characterKey=primary_speaker,
                sceneRole=f"leads the visible action for page {page.pageNumber}",
                expectedPosition="center",
            )
        ]
        if secondary_speaker != primary_speaker:
            characters_in_scene.append(
                WebtoonCharacterInScene(
                    characterKey=secondary_speaker,
                    sceneRole=f"reacts and speaks with {primary_speaker} in this scene",
                    expectedPosition="left" if page.pageNumber % 2 else "right",
                )
            )

        first_sentence = page.sentences[0]
        middle_sentence = page.sentences[min(1, len(page.sentences) - 1)]
        last_sentence = page.sentences[-1]
        sentences = [
            WebtoonStorySentence(
                sentenceOrder=1,
                type="NARRATION",
                speakerKey="narrator",
                englishText=first_sentence.englishText,
                koreanText=first_sentence.koreanText,
                emotion=first_sentence.emotion,
            ),
            WebtoonStorySentence(
                sentenceOrder=2,
                type="DIALOGUE",
                speakerKey=primary_speaker,
                englishText=_local_dialogue_for_page(page.pageNumber, primary_speaker),
                koreanText=_local_dialogue_for_page(page.pageNumber, primary_speaker),
                emotion="EXCITED" if page.pageNumber == 1 else "CURIOUS",
            ),
            WebtoonStorySentence(
                sentenceOrder=3,
                type="DIALOGUE",
                speakerKey=secondary_speaker,
                englishText=middle_sentence.englishText,
                koreanText=middle_sentence.koreanText,
                emotion=middle_sentence.emotion,
            ),
            WebtoonStorySentence(
                sentenceOrder=4,
                type="DIALOGUE",
                speakerKey=primary_speaker,
                englishText=last_sentence.englishText,
                koreanText=last_sentence.koreanText,
                emotion=last_sentence.emotion,
            ),
        ]
        english_text = " ".join(sentence.englishText for sentence in sentences)
        korean_text = " ".join(sentence.koreanText for sentence in sentences)
        pages.append(
            WebtoonStoryboardPage(
                pageNumber=page.pageNumber,
                sourcePhotoIds=page.sourcePhotoIds,
                sceneSummary=page.sceneSummary,
                englishText=english_text,
                koreanText=korean_text,
                imagePrompt=(
                    f"{page.imagePrompt} Webtoon character staging: "
                    + "; ".join(
                        f"{item.characterKey} {item.sceneRole}, positioned {item.expectedPosition}"
                        for item in characters_in_scene
                    )
                    + "."
                ),
                charactersInScene=characters_in_scene,
                sentences=sentences,
                sentenceCount=len(sentences),
                wordCount=_count_words(english_text),
            )
        )

    response = WebtoonStoryboardGenerateResponse(
        title=base.title,
        synopsis=base.synopsis,
        moralTheme=base.moralTheme,
        storyQuest=base.storyQuest,
        recurringMotif=base.recurringMotif,
        pageCount=len(pages),
        pageCountReason=base.pageCountReason + " Webtoon mode adds dialogue-led sentence metadata.",
        readingLevel=base.readingLevel,
        totalWordCount=sum(page.wordCount for page in pages),
        pages=pages,
        usage=UsageInfo(
            model="local-webtoon-storyboard-fallback",
            inputTokens=0,
            outputTokens=0,
            totalTokens=0,
            costUsd=0.0,
            promptTemplateVersion=WEBTOON_STORYBOARD_PROMPT_TEMPLATE_VERSION,
        ),
    )
    _reconcile_webtoon_derived_counts(response)
    return response


def _webtoon_character_keys(request: StoryboardGenerateRequest) -> list[dict[str, str]]:
    characters: list[dict[str, str]] = []
    used_keys: set[str] = set()
    for child in request.children:
        character_key = _unique_character_key(child.name, used_keys)
        characters.append(
            {
                "characterKey": character_key,
                "displayName": child.name,
                "role": "child",
            }
        )
    for companion in request.companions:
        character_key = _unique_character_key(companion, used_keys)
        characters.append(
            {
                "characterKey": character_key,
                "displayName": companion,
                "role": "companion",
            }
        )
    characters.append(
        {
            "characterKey": "narrator",
            "displayName": "Narrator",
            "role": "narrator",
        }
    )
    return characters


def _unique_character_key(name: str, used_keys: set[str]) -> str:
    base = name.strip() or "character"
    candidate = base
    suffix = 2
    while candidate in used_keys or candidate == "narrator":
        candidate = f"{base}_{suffix}"
        suffix += 1
    used_keys.add(candidate)
    return candidate


def _local_dialogue_for_page(page_number: int, speaker_key: str) -> str:
    if page_number == 1:
        return "What should we discover first?"
    return f"Look, I found another clue!"


def _build_regenerate_fallback_request(
    request: StoryboardRegenerateRequest,
) -> StoryboardGenerateRequest:
    original_request = request.originalRequest.model_copy(deep=True)
    if request.storyId is not None:
        original_request.storyId = request.storyId
    if request.feedbackInstruction:
        existing = (original_request.additionalInstruction or "").strip()
        extra = f"Regeneration feedback: {request.feedbackInstruction.strip()}"
        original_request.additionalInstruction = f"{existing}\n{extra}".strip() if existing else extra
    return original_request


def _build_webtoon_regenerate_fallback_request(
    request: WebtoonStoryboardRegenerateRequest,
) -> StoryboardGenerateRequest:
    original_request = request.originalRequest.model_copy(deep=True)
    if request.storyId is not None:
        original_request.storyId = request.storyId
    if request.feedbackInstruction:
        existing = (original_request.additionalInstruction or "").strip()
        extra = f"Webtoon regeneration feedback: {request.feedbackInstruction.strip()}"
        original_request.additionalInstruction = f"{existing}\n{extra}".strip() if existing else extra
    return original_request


def _reading_level_for_age(age: int) -> ReadingLevel:
    if age <= 6:
        return ReadingLevel(
            basedOnAge=age,
            sentencesPerPage="2-3",
            wordsPerSentence="8-14",
            reason="The youngest child is 6 or younger, so each page uses short read-aloud storybook narration.",
        )
    if age <= 9:
        return ReadingLevel(
            basedOnAge=age,
            sentencesPerPage="3-5",
            wordsPerSentence="8-16",
            reason="The youngest child is 7 to 9, so each page uses fuller narration with gentle storybook details.",
        )
    return ReadingLevel(
        basedOnAge=age,
        sentencesPerPage="4-6",
        wordsPerSentence="10-20",
        reason="The youngest child is 10 or older, so each page uses richer final storybook narration.",
    )


def _choose_page_count(photo_count: int, min_pages: int, max_pages: int) -> int:
    if photo_count <= 12:
        desired = max(min_pages, photo_count)
    elif photo_count <= 20:
        desired = min(max_pages, max(12, round(photo_count * 0.8)))
    else:
        desired = min(max_pages, max(16, round(photo_count * 0.7)))
    return max(min_pages, min(max_pages, desired))


def _group_photos(photos: list, page_count: int) -> list[list]:
    if len(photos) >= page_count:
        groups = [[] for _ in range(page_count)]
        for index, photo in enumerate(photos):
            group_index = min(page_count - 1, index * page_count // len(photos))
            groups[group_index].append(photo)
        return [group or [photos[0]] for group in groups]
    return [[photo] for photo in islice(cycle(photos), page_count)]


def _build_local_premise(
    child_name: str,
    companion_text: str,
    travel_place: str,
    photos: list,
    approved_summary: ApprovedStorySummary | None,
) -> str:
    if approved_summary:
        return approved_summary.summary
    memories = ", ".join(photo.description for photo in photos[:5])
    return (
        f"{child_name} travels through {travel_place} with {companion_text}, "
        f"following ordinary memories like {memories} to learn where courage hides."
    )


def _format_companions(companions: list[str]) -> str:
    if not companions:
        return "family"
    if len(companions) == 1:
        return companions[0]
    if len(companions) == 2:
        return f"{companions[0]} and {companions[1]}"
    return ", ".join(companions[:-1]) + f", and {companions[-1]}"


def _scene_summary(page_number: int, page_count: int, description: str, travel_place: str) -> str:
    if page_number == 1:
        return f"Opening question at {travel_place}: the child begins a search for courage."
    if page_number == page_count:
        return f"Resolution at {travel_place}: the child understands the lesson of the trip."
    return f"Story step {page_number}: this memory deepens the child's quest. Photo detail: {description}"


def _sentences_for_page(
    page_number: int,
    page_count: int,
    child_name: str,
    companion_text: str,
    photo_description: str,
    travel_place: str,
    magic_level: str,
    premise: str,
) -> list[StorySentence]:
    if page_number == 1:
        english = [
            f"{child_name} arrived at {travel_place} with {companion_text}.",
            "A shy sunbeam slipped beside the path, as if it had a secret to share.",
            f"{child_name} wondered where courage might hide in this new and shining place.",
        ]
        korean = [
            f"{child_name} arrived at {travel_place} with {companion_text}.",
            "A shy sunbeam slipped beside the path, as if it had a secret to share.",
            f"{child_name} wondered where courage might hide in this new and shining place.",
        ]
        emotions = ["WARM", "CURIOUS", "CURIOUS"]
    elif page_number == page_count:
        english = [
            f"At last, {child_name} understood what the trip had been teaching all along.",
            "The shy sunbeam had not been pointing to a place, but to each kind and brave choice.",
            "Whenever the family opened this book, the little adventure could begin again.",
        ]
        korean = [
            f"At last, {child_name} understood what the trip had been teaching all along.",
            "The shy sunbeam had not been pointing to a place, but to each kind and brave choice.",
            "Whenever the family opened this book, the little adventure could begin again.",
        ]
        emotions = ["TENDER", "WARM", "HAPPY"]
    else:
        bridge = _bridge_sentence(page_number, page_count, child_name)
        english = [
            bridge,
            f"The next clue came from the trip itself: {photo_description}.",
            _magic_sentence(child_name, magic_level),
            f"The shy sunbeam seemed to wait, as if asking what brave or kind thing {child_name} would try next.",
        ]
        korean = [
            bridge,
            f"The next clue came from the trip itself: {photo_description}.",
            _magic_sentence_ko(child_name, magic_level),
            f"The shy sunbeam seemed to wait, as if asking what brave or kind thing {child_name} would try next.",
        ]
        emotions = ["BRAVE", "CURIOUS", "CALM", "CURIOUS"]

    return [
        StorySentence(sentenceOrder=index, englishText=en, koreanText=ko, emotion=emotion)
        for index, (en, ko, emotion) in enumerate(zip(english, korean, emotions), start=1)
    ]


def _magic_sentence(child_name: str, magic_level: str) -> str:
    if magic_level == "NONE":
        return f"{child_name} smiled with the family."
    if magic_level == "FANTASY":
        return "For a second, the whole place felt like a tiny magic kingdom."
    return "Even the sunlight seemed to smile softly."


def _bridge_sentence(page_number: int, page_count: int, child_name: str) -> str:
    if page_number < page_count / 3:
        return f"So {child_name} tried one small brave step."
    if page_number < page_count * 2 / 3:
        return f"The adventure grew, and {child_name} began to understand the trip in a new way."
    return f"Step by step, {child_name} carried each memory toward the answer waiting at the end."


def _magic_sentence_ko(child_name: str, magic_level: str) -> str:
    if magic_level == "NONE":
        return f"{child_name} smiled with the family."
    if magic_level == "FANTASY":
        return "For a second, the whole place felt like a tiny magic kingdom."
    return "Even the sunlight seemed to smile softly."


def _image_prompt(
    child_name: str,
    scene_summary: str,
    travel_place: str,
    hashtags: list[str],
) -> str:
    hashtag_text = ", ".join(hashtags) if hashtags else "family memory"
    return (
        "A rough pre-coloring children's book storyboard sketch, warm and gentle, "
        f"featuring {child_name} at {travel_place}. Scene: {scene_summary}. "
        "Loose pencil-and-ink linework, minimal shading, no polished final rendering. "
        f"Visual hints: {hashtag_text}."
    )
