import json
import logging
import re

from app.core.config import settings
from app.schemas.storyboard import (
    StorySentence,
    StorySentenceTranslationRequest,
    StorySentenceTranslationResponse,
    UsageInfo,
)
from app.services.storyboard_prompt import STORYBOARD_SUMMARY_PROMPT_TEMPLATE_VERSION

logger = logging.getLogger(__name__)

STORY_SENTENCE_TRANSLATION_PROMPT_TEMPLATE_VERSION = (
    f"{STORYBOARD_SUMMARY_PROMPT_TEMPLATE_VERSION}:sentence_translation_v1"
)

STORY_SENTENCE_TRANSLATION_SYSTEM_PROMPT = """
You translate revised Korean storybook page text into English sentence JSON.

Rules:
- Return only valid JSON matching the requested schema.
- Preserve the meaning, tone, names, and storybook warmth of the Korean text.
- Split the Korean text into natural sentence units.
- Translate each Korean sentence into one clear English read-aloud sentence.
- Do not add new plot details that are not present in the Korean text.
- Keep sentenceOrder as a 1-based index.
- Each sentence must include englishText, koreanText, and emotion.
- Choose emotion from: NEUTRAL, HAPPY, SAD, EXCITED, CALM, CURIOUS, SURPRISED, WARM, TENDER, BRAVE.
- englishText must exactly equal sentences[].englishText joined with one space.
- koreanText must exactly equal sentences[].koreanText joined with one space.
- sentenceCount must equal the number of sentences.
- wordCount must equal the number of English words in englishText.
""".strip()


def translate_story_sentences(
    request: StorySentenceTranslationRequest,
) -> StorySentenceTranslationResponse:
    use_openai = bool(settings.OPENAI_API_KEY)
    logger.info(
        "[SENTENCE:TRANSLATE] service entry useOpenAI=%s, koreanLen=%d",
        use_openai,
        len(request.koreanText),
    )
    if use_openai:
        return _translate_with_openai(request)
    return _translate_locally(request)


def _translate_with_openai(
    request: StorySentenceTranslationRequest,
) -> StorySentenceTranslationResponse:
    try:
        from openai import OpenAI
        from openai import OpenAIError
    except ImportError as exc:
        raise RuntimeError("openai package is not installed") from exc

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    schema = _to_openai_strict_json_schema(StorySentenceTranslationResponse.model_json_schema())
    input_content = [
        {
            "type": "input_text",
            "text": (
                "Translate this revised Korean page text into English and return the "
                "same sentence JSON shape used by storyboard pages."
            ),
        },
        {
            "type": "input_text",
            "text": json.dumps(request.model_dump(mode="json"), ensure_ascii=False),
        },
    ]
    request_args = {
        "model": settings.STORYBOARD_SUMMARY_MODEL,
        "input": [
            {"role": "system", "content": STORY_SENTENCE_TRANSLATION_SYSTEM_PROMPT},
            {"role": "user", "content": input_content},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "story_sentence_translation_response",
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
        logger.exception("[SENTENCE:TRANSLATE] OpenAI call failed")
        raise ValueError(f"OpenAI story sentence translation failed: {exc}") from exc

    parsed = StorySentenceTranslationResponse.model_validate_json(response.output_text)
    _reconcile_translation(parsed)
    _apply_usage(parsed, response.usage)
    logger.info(
        "[SENTENCE:TRANSLATE] OpenAI call done sentenceCount=%d, inputTok=%s, outputTok=%s, costUsd=%s",
        parsed.sentenceCount,
        parsed.usage.inputTokens,
        parsed.usage.outputTokens,
        parsed.usage.costUsd,
    )
    return parsed


def _apply_usage(parsed: StorySentenceTranslationResponse, usage: object) -> None:
    token_usage = _extract_token_usage(usage)
    parsed.usage.model = settings.STORYBOARD_SUMMARY_MODEL
    parsed.usage.inputTokens = token_usage["input_tokens"]
    parsed.usage.outputTokens = token_usage["output_tokens"]
    parsed.usage.totalTokens = token_usage["total_tokens"]
    parsed.usage.costUsd = _estimate_summary_cost_usd(
        input_tokens=token_usage["input_tokens"],
        output_tokens=token_usage["output_tokens"],
    )
    parsed.usage.promptTemplateVersion = STORY_SENTENCE_TRANSLATION_PROMPT_TEMPLATE_VERSION


def _reconcile_translation(parsed: StorySentenceTranslationResponse) -> None:
    for index, sentence in enumerate(parsed.sentences, start=1):
        sentence.sentenceOrder = index
    parsed.englishText = " ".join(sentence.englishText.strip() for sentence in parsed.sentences).strip()
    parsed.koreanText = " ".join(sentence.koreanText.strip() for sentence in parsed.sentences).strip()
    parsed.sentenceCount = len(parsed.sentences)
    parsed.wordCount = _count_words(parsed.englishText)


def _translate_locally(
    request: StorySentenceTranslationRequest,
) -> StorySentenceTranslationResponse:
    korean_sentences = _split_korean_sentences(request.koreanText)
    sentences = [
        StorySentence(
            sentenceOrder=index,
            englishText=f"Korean revised sentence {index}: {sentence}",
            koreanText=sentence,
            emotion="WARM",
        )
        for index, sentence in enumerate(korean_sentences, start=1)
    ]
    response = StorySentenceTranslationResponse(
        sentences=sentences,
        englishText="",
        koreanText="",
        sentenceCount=0,
        wordCount=0,
        usage=UsageInfo(
            model="local-story-sentence-translation-fallback",
            inputTokens=0,
            outputTokens=0,
            totalTokens=0,
            costUsd=0.0,
            promptTemplateVersion=STORY_SENTENCE_TRANSLATION_PROMPT_TEMPLATE_VERSION,
        ),
    )
    _reconcile_translation(response)
    return response


def _split_korean_sentences(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    parts = [part.strip() for part in re.findall(r"[^.!?]+[.!?]?", normalized) if part.strip()]
    return parts or [normalized]


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
