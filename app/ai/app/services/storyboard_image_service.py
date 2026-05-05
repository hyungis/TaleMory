import base64
import json
import mimetypes
import time
from functools import lru_cache
from urllib import error, parse, request

import boto3

from app.core.config import settings
from app.schemas.storyboard_image import (
    StoryboardCharacterReferenceGenerateRequest,
    StoryboardCharacterReferenceGenerateResponse,
    StoryboardImageBatchUsage,
    StoryboardImageGenerateItemRequest,
    StoryboardImageGenerateRequest,
    StoryboardImageGenerateResponse,
    StoryboardImageGenerateResult,
    StoryboardImageRegenerateRequest,
    StoryboardImageRegenerateResponse,
    StoryboardImageUsage,
)

_ONE_PIXEL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn8J9sAAAAASUVORK5CYII="
)
_FIXED_STORYBOARD_SKETCH_INSTRUCTION = (
    "Keep it as a black-and-white rough pre-coloring storyboard sketch only. "
    "Use loose pencil or ink linework on mostly white paper. Do not add colored fills, accent colors, "
    "watercolor washes, painted shading, polished lighting, or final illustration rendering."
)

_GEMINI_RETRY_DELAY_SECONDS = 0.5
_CHARACTER_REFERENCE_OBJECT_PATH_TEMPLATE = "stories/{story_id}/storyboard-character/reference.png"
_MAX_GEMINI_REFERENCE_IMAGES = 3


def _apply_env_prefix(relative_key: str) -> str:
    """
    같은 버킷 내에서 환경(local/dev/prod) 격리를 위해 모든 object path 앞에 prepend.
    upload + 응답 반환(BE 가 grounding 용으로 다시 보내옴) 모두 동일 키 형식 유지를 위해
    path 빌더에서 prefix 를 박는다.
    """
    env_prefix = (settings.AWS_S3_ENV_PREFIX or "").strip("/")
    if not env_prefix:
        return relative_key
    return f"{env_prefix}/{relative_key}"


def _character_reference_object_path(story_id: int) -> str:
    """env-prefixed `{env}/stories/{story_id}/storyboard-character/reference.png`."""
    return _apply_env_prefix(_CHARACTER_REFERENCE_OBJECT_PATH_TEMPLATE.format(story_id=story_id))


def generate_storyboard_images(request_model: StoryboardImageGenerateRequest) -> StoryboardImageGenerateResponse:
    results: list[StoryboardImageGenerateResult] = []
    storyboard_seed = request_model.seed
    items = ensure_storyboard_character_reference(
        request_model.storyId,
        storyboard_seed,
        request_model.items,
        request_model.characterSourceImageUrls,
        request_model.characterSourceImageS3Keys,
    )

    for item in items:
        results.append(generate_storyboard_image_item(request_model.storyId, item, storyboard_seed))

    return StoryboardImageGenerateResponse(
        storyId=request_model.storyId,
        seed=storyboard_seed,
        results=results,
        usage=_aggregate_usage(results),
    )


def ensure_storyboard_character_reference(
    story_id: int,
    seed: int,
    items: list[StoryboardImageGenerateItemRequest],
    character_source_image_urls: list[str] | None = None,
    character_source_image_s3_keys: list[str] | None = None,
) -> list[StoryboardImageGenerateItemRequest]:
    if not items:
        return items
    if any(item.characterReferenceImageUrls or item.characterReferenceImageS3Keys for item in items):
        return items

    first_item = items[0]
    reference_image_urls = _unique_refs(
        character_source_image_urls or [ref for item in items for ref in item.referenceImageUrls],
        limit=3,
    )
    reference_image_s3_keys = _unique_refs(
        character_source_image_s3_keys or [ref for item in items for ref in item.referenceImageS3Keys],
        limit=3,
    )
    character_response = generate_storyboard_character_reference(
        StoryboardCharacterReferenceGenerateRequest(
            storyId=story_id,
            seed=seed,
            storyboard=first_item.storyboard,
            children=first_item.children,
            companions=first_item.companions,
            referenceImageS3Keys=reference_image_s3_keys,
            referenceImageUrls=reference_image_urls,
        )
    )
    character_s3_key = _character_reference_object_path(story_id)
    return [
        item.model_copy(
            update={
                "characterReferenceImageS3Keys": [character_s3_key],
                "characterReferenceImageUrls": [character_response.imageUrl],
            }
        )
        for item in items
    ]


def generate_storyboard_character_reference(
    request_model: StoryboardCharacterReferenceGenerateRequest,
) -> StoryboardCharacterReferenceGenerateResponse:
    if settings.GEMINI_API_KEY:
        return _generate_character_reference_with_gemini(request_model)
    return _generate_character_reference_locally(request_model)


def _unique_refs(values: list[str], limit: int) -> list[str]:
    refs: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value in seen:
            continue
        refs.append(value)
        seen.add(value)
        if len(refs) >= limit:
            break
    return refs


def regenerate_storyboard_image(
    request_model: StoryboardImageRegenerateRequest,
) -> StoryboardImageRegenerateResponse:
    baseline_item = ensure_storyboard_character_reference_for_regenerate(
        request_model.storyId,
        request_model.item,
    )
    regenerate_item = _build_regenerate_item(baseline_item, request_model.userPrompt)
    result = generate_storyboard_image_item(
        request_model.storyId,
        regenerate_item,
        request_model.seed,
        output_version=request_model.outputVersion,
    )

    return StoryboardImageRegenerateResponse(
        storyId=request_model.storyId,
        seed=request_model.seed,
        outputVersion=request_model.outputVersion,
        result=result,
    )


def ensure_storyboard_character_reference_for_regenerate(
    story_id: int,
    item: StoryboardImageGenerateItemRequest,
) -> StoryboardImageGenerateItemRequest:
    if item.characterReferenceImageUrls or item.characterReferenceImageS3Keys:
        return item

    character_s3_key = _character_reference_object_path(story_id)
    return item.model_copy(
        update={
            "characterReferenceImageS3Keys": [character_s3_key],
        }
    )


def generate_storyboard_image_item(
    story_id: int,
    item: StoryboardImageGenerateItemRequest,
    seed: int,
    output_version: int | None = None,
) -> StoryboardImageGenerateResult:
    if settings.GEMINI_API_KEY:
        return _generate_item_with_gemini(story_id, item, seed, output_version)
    return _generate_item_locally(story_id, item, output_version)


def _generate_item_with_gemini(
    story_id: int,
    item: StoryboardImageGenerateItemRequest,
    seed: int,
    output_version: int | None = None,
) -> StoryboardImageGenerateResult:
    final_prompt = _build_final_prompt(item)
    response_json = _call_gemini_image_api(
        final_prompt,
        item.characterReferenceImageUrls,
        item.characterReferenceImageS3Keys,
        item.referenceImageUrls,
        item.referenceImageS3Keys,
        seed,
    )
    try:
        image_bytes = _extract_image_bytes(response_json)
    except ValueError as exc:
        if "no image data" not in str(exc):
            raise
        time.sleep(_GEMINI_RETRY_DELAY_SECONDS)
        retry_prompt = (
            f"{final_prompt}\n"
            "Return only the generated image. Do not return any explanatory text."
        )
        retry_response_json = _call_gemini_image_api(
            retry_prompt,
            item.characterReferenceImageUrls,
            item.characterReferenceImageS3Keys,
            item.referenceImageUrls,
            item.referenceImageS3Keys,
            seed,
        )
        image_bytes = _extract_image_bytes(retry_response_json)
        response_json = retry_response_json
    image_url = _upload_and_resolve_url(story_id, item, image_bytes, output_version)
    usage = _extract_gemini_usage(response_json)
    return StoryboardImageGenerateResult(
        pageNumber=item.pageNumber,
        imageUrl=image_url,
        usage=usage,
    )


def _generate_item_locally(
    story_id: int,
    item: StoryboardImageGenerateItemRequest,
    output_version: int | None = None,
) -> StoryboardImageGenerateResult:
    image_url = _upload_and_resolve_url(story_id, item, _ONE_PIXEL_PNG, output_version)
    return StoryboardImageGenerateResult(
        pageNumber=item.pageNumber,
        imageUrl=image_url,
        usage=StoryboardImageUsage(
            provider="local",
            model=settings.STORYBOARD_IMAGE_MODEL,
            promptTokens=0,
            candidateTokens=0,
            totalTokens=0,
            imageCount=1,
            costUsd=0.0,
        ),
    )


def _generate_character_reference_with_gemini(
    request_model: StoryboardCharacterReferenceGenerateRequest,
) -> StoryboardCharacterReferenceGenerateResponse:
    final_prompt = _build_character_reference_prompt(request_model)
    response_json = _call_gemini_image_api(
        final_prompt=final_prompt,
        character_reference_image_urls=[],
        character_reference_image_s3_keys=[],
        reference_image_urls=request_model.referenceImageUrls,
        reference_image_s3_keys=request_model.referenceImageS3Keys,
        seed=request_model.seed,
    )
    try:
        image_bytes = _extract_image_bytes(response_json)
    except ValueError as exc:
        if "no image data" not in str(exc):
            raise
        time.sleep(_GEMINI_RETRY_DELAY_SECONDS)
        retry_response_json = _call_gemini_image_api(
            final_prompt=f"{final_prompt}\nReturn only the generated image. Do not return explanatory text.",
            character_reference_image_urls=[],
            character_reference_image_s3_keys=[],
            reference_image_urls=request_model.referenceImageUrls,
            reference_image_s3_keys=request_model.referenceImageS3Keys,
            seed=request_model.seed,
        )
        image_bytes = _extract_image_bytes(retry_response_json)
        response_json = retry_response_json

    image_url = _upload_and_resolve_character_reference_url(request_model.storyId, image_bytes)
    return StoryboardCharacterReferenceGenerateResponse(
        storyId=request_model.storyId,
        seed=request_model.seed,
        imageUrl=image_url,
        usage=_extract_gemini_usage(response_json),
    )


def _generate_character_reference_locally(
    request_model: StoryboardCharacterReferenceGenerateRequest,
) -> StoryboardCharacterReferenceGenerateResponse:
    image_url = _upload_and_resolve_character_reference_url(request_model.storyId, _ONE_PIXEL_PNG)
    return StoryboardCharacterReferenceGenerateResponse(
        storyId=request_model.storyId,
        seed=request_model.seed,
        imageUrl=image_url,
        usage=StoryboardImageUsage(
            provider="local",
            model=settings.STORYBOARD_IMAGE_MODEL,
            promptTokens=0,
            candidateTokens=0,
            totalTokens=0,
            imageCount=1,
            costUsd=0.0,
        ),
    )


def _build_regenerate_item(
    item: StoryboardImageGenerateItemRequest,
    user_prompt: str,
) -> StoryboardImageGenerateItemRequest:
    instruction_parts = []
    if item.additionalInstruction:
        instruction_parts.append(item.additionalInstruction.strip())
    instruction_parts.append(f"User regeneration request: {user_prompt.strip()}")
    return item.model_copy(
        update={
            "additionalInstruction": "\n".join(part for part in instruction_parts if part),
        }
    )


def _build_final_prompt(item: StoryboardImageGenerateItemRequest) -> str:
    child_descriptions = ", ".join(
        f"{child.name} ({child.age}, {child.gender.lower()})" for child in item.children
    )
    companions = ", ".join(item.companions) if item.companions else "family"
    has_character_reference = bool(item.characterReferenceImageUrls or item.characterReferenceImageS3Keys)
    has_scene_reference = bool(item.referenceImageUrls or item.referenceImageS3Keys)
    parts = [
        f"# Storyboard Image Prompt - Page {item.pageNumber}",
        "",
        "## Non-Negotiable Visual Mode",
        "- Black-and-white rough pre-coloring storyboard sketch only.",
        "- The image must look like an unfinished production storyboard, not a finished children's book illustration.",
        "- Use mostly white paper, loose graphite pencil or black ink lines, construction lines, sparse hatching, and minimal light-gray sketch marks.",
        (
            "- Do not add any color: no colored fills, no accent colors, no warm palette, no pastel tint, "
            "no watercolor wash, no crayon color, no colored pencil, no collage color, no saturated color."
        ),
        (
            "- Do not create a polished image: no digital painting, no smooth 3D shading, no final-render lighting, "
            "no detailed texture rendering, no completed background painting."
        ),
        "",
        "## Objective",
        "- Create a rough pre-coloring children's storybook storyboard sketch for layout and scene planning.",
        "",
        "## Story Context",
        f"- Title: {item.storyboard.title}",
        f"- Synopsis: {item.storyboard.synopsis}",
        f"- Page: {item.pageNumber}",
        f"- Scene summary: {item.page.sceneSummary}",
        f"- English text: {item.page.englishText}",
        f"- Korean text: {item.page.koreanText}",
        f"- Base image prompt: {item.page.imagePrompt}",
        "",
        "## Characters",
        f"- Main children: {child_descriptions}",
        f"- Companions in scene: {companions}",
        (
            "- Character consistency lock: preserve the same child identity across every page. "
            "Keep face shape, apparent age, hairstyle, hair color, body proportion, and recurring accessories stable. "
            "Do not invent a different child, sibling, haircut, outfit color scheme, or facial structure unless explicitly requested."
        ),
        "",
        "## Visual Direction",
        "- Rough storyboard sketch, monochrome pencil/ink lines, no polished final rendering, child-safe composition.",
        "- If the base image prompt asks for an illustration, storybook look, warmth, or any color style, reinterpret it as black-and-white sketch composition only.",
        "",
        "## Hard Constraints",
        (
            "- Absolutely no visible text anywhere in the image. Do not render any words, letters, captions, subtitles, "
            "speech bubbles, sound effects, typographic elements, signage, labels, logos, packaging text, poster text, "
            "UI text, or watermarks. If an object would normally contain text, render it as blank abstract shapes or "
            "texture with no readable characters."
        ),
        "- Color ban: the final image must contain no intentional color. Use black, white, and light gray only.",
    ]
    if has_character_reference:
        parts.extend(
            [
                "",
                "## Character Reference",
                (
                    "- When a character identity reference is available, it is the first reference image. "
                    "Use it only for identity: each character's face, hairstyle, apparent age, and body proportion. "
                    "Do not copy the character reference image's color, color rendering, painted finish, lighting style, or completed illustration look. "
                    "Do not copy the character reference sheet layout, side-by-side lineup, neutral pose, white background, or character-sheet composition. "
                    "Use scene photos only for outfit, pose, background, props, lighting, and travel memory context. "
                    "If character and scene references conflict, preserve the character reference identity and borrow the scene/outfit from the scene reference."
                ),
                "- The output must be the requested storyboard page scene, not a character reference sheet.",
                "- Place the characters naturally inside the page scene described above. Do not render isolated front-facing character lineup poses unless the page scene explicitly asks for that.",
                "- Convert all reference-image color information into monochrome line structure. Treat color as forbidden noise.",
            ]
        )
    if has_scene_reference:
        parts.extend(
            [
                "",
                "## Scene References",
                (
                    "- Later reference images provide page-specific travel mood, clothing, pose, props, and background. "
                    "Do not copy a different face from the scene reference when a character identity reference is provided."
                ),
                "- Use scene references for layout and object placement only. Do not copy their color palette, lighting, or rendered finish.",
            ]
        )
    additional_instruction = _compose_additional_instruction(item.additionalInstruction)
    parts.extend(["", "## Additional Instruction"])
    parts.extend(f"- {line}" for line in additional_instruction.splitlines() if line.strip())
    return "\n".join(parts)


def _build_character_reference_prompt(request_model: StoryboardCharacterReferenceGenerateRequest) -> str:
    child_descriptions = ", ".join(
        f"{child.name} ({child.age}, {child.gender.lower()})" for child in request_model.children
    )
    companions = ", ".join(request_model.companions) if request_model.companions else "no named companions"
    character_sheet_subjects = _format_character_sheet_subjects(request_model)
    parts = [
        "# Storyboard Character Reference Prompt",
        "",
        "## Objective",
        "- Create one reusable family character reference sheet for a children's storybook storyboard.",
        "- The image must function as the fixed identity reference for all later storyboard pages.",
        "",
        "## Visual Style",
        "- Render as a rough black-and-white storyboard character reference sketch.",
        "- Use loose pencil or ink linework on mostly white paper.",
        "- Keep it unfinished and pre-coloring, suitable as a production reference sheet.",
        "- Do not use colored fills, watercolor, crayon, digital painting, polished lighting, or finished illustration rendering.",
        "",
        "## Story Characters",
        f"- Title: {request_model.storyboard.title}",
        f"- Synopsis: {request_model.storyboard.synopsis}",
        f"- Main children: {child_descriptions}",
        f"- Companions: {companions}",
        f"- Character sheet subjects: {character_sheet_subjects}",
        "",
        "## Source Photo Handling",
        (
            "- Use the provided family photo or reference photos only to infer each person's identity, age range, "
            "face shape, hairstyle, and body proportion."
        ),
        "- If multiple photos are provided, combine identity clues carefully without merging people into one identity.",
        "- Do not copy photo lighting, background, camera angle, or rendered finish.",
        "",
        "## Character Sheet Requirements",
        f"- Show {character_sheet_subjects} clearly side by side in a clean character sheet layout.",
        "- Preserve distinct faces for each person. Do not merge their identities.",
        (
            "- Do not change their apparent age, hairstyle, face shape, facial structure, or body proportion "
            "unless the story character information explicitly requires it."
        ),
        "- Use simple neutral outfits unless the photo has a strongly recognizable outfit.",
        "- Avoid detailed background.",
        "",
        "## Hard Constraints",
        "- No visible text, labels, captions, or watermarks.",
        "- Do not create extra family members or omit requested story characters.",
    ]
    return "\n".join(parts)


def _format_character_sheet_subjects(request_model: StoryboardCharacterReferenceGenerateRequest) -> str:
    child_names = [child.name for child in request_model.children]
    subjects = child_names + request_model.companions
    if not subjects:
        return "the requested story family characters"
    if len(subjects) == 1:
        return subjects[0]
    if len(subjects) == 2:
        return f"{subjects[0]} and {subjects[1]}"
    return f"{', '.join(subjects[:-1])}, and {subjects[-1]}"


def _compose_additional_instruction(additional_instruction: str | None) -> str:
    instruction_parts = [_FIXED_STORYBOARD_SKETCH_INSTRUCTION]
    if additional_instruction and additional_instruction.strip():
        instruction_parts.append(additional_instruction.strip())
    return "\n".join(instruction_parts)


def _call_gemini_image_api(
    final_prompt: str,
    character_reference_image_urls: list[str],
    character_reference_image_s3_keys: list[str],
    reference_image_urls: list[str],
    reference_image_s3_keys: list[str],
    seed: int,
) -> dict:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    api_url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.STORYBOARD_IMAGE_MODEL}:generateContent?key={parse.quote(settings.GEMINI_API_KEY)}"
    )
    parts = _build_gemini_parts(
        final_prompt,
        character_reference_image_urls,
        character_reference_image_s3_keys,
        reference_image_urls,
        reference_image_s3_keys,
    )
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": _build_gemini_generation_config(seed),
    }
    req = request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"Gemini image generation failed: {exc.code} {body}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"Gemini image generation network error: {exc.reason}") from exc


def _build_gemini_parts(
    final_prompt: str,
    character_reference_image_urls: list[str],
    character_reference_image_s3_keys: list[str],
    reference_image_urls: list[str],
    reference_image_s3_keys: list[str],
) -> list[dict]:
    parts: list[dict] = []
    parts.extend(_download_image_parts(character_reference_image_s3_keys[:1], from_s3=True, remaining=1))
    if not parts:
        parts.extend(_download_image_parts(character_reference_image_urls[:1], from_s3=False, remaining=1))

    remaining = _MAX_GEMINI_REFERENCE_IMAGES - len(parts)
    if remaining > 0:
        scene_s3_parts = _download_image_parts(reference_image_s3_keys, from_s3=True, remaining=remaining)
        parts.extend(scene_s3_parts)
    remaining = _MAX_GEMINI_REFERENCE_IMAGES - len(parts)
    if remaining > 0:
        parts.extend(_download_image_parts(reference_image_urls, from_s3=False, remaining=remaining))
    parts.append({"text": final_prompt})
    return parts


def _download_image_parts(image_refs: list[str], from_s3: bool, remaining: int) -> list[dict]:
    parts: list[dict] = []
    for image_ref in image_refs:
        if len(parts) >= remaining:
            break
        downloaded = _download_reference_image_from_s3(image_ref) if from_s3 else _download_reference_image(image_ref)
        if downloaded is None:
            continue
        mime_type, raw_bytes = downloaded
        parts.append(
            {
                "inlineData": {
                    "mimeType": mime_type,
                    "data": base64.b64encode(raw_bytes).decode("ascii"),
                }
            }
        )
    return parts


def _build_gemini_generation_config(seed: int) -> dict:
    return {
        "responseModalities": ["Image"],
        "seed": seed,
    }


def _download_reference_image(image_url: str) -> tuple[str, bytes] | None:
    try:
        with request.urlopen(image_url, timeout=30) as response:
            raw_bytes = response.read()
            mime_type = response.headers.get_content_type()
            if mime_type == "application/octet-stream":
                mime_type = mimetypes.guess_type(image_url)[0] or "image/png"
            return mime_type, raw_bytes
    except Exception:
        return None


@lru_cache
def _get_s3_client():
    client_kwargs: dict[str, object] = {}
    if settings.STORYBOARD_IMAGE_S3_REGION:
        client_kwargs["region_name"] = settings.STORYBOARD_IMAGE_S3_REGION
    if settings.STORYBOARD_IMAGE_S3_ACCESS_KEY_ID:
        client_kwargs["aws_access_key_id"] = settings.STORYBOARD_IMAGE_S3_ACCESS_KEY_ID
    if settings.STORYBOARD_IMAGE_S3_SECRET_ACCESS_KEY:
        client_kwargs["aws_secret_access_key"] = settings.STORYBOARD_IMAGE_S3_SECRET_ACCESS_KEY
    return boto3.client("s3", **client_kwargs)


def _download_reference_image_from_s3(s3_key: str) -> tuple[str, bytes] | None:
    if not settings.STORYBOARD_IMAGE_S3_BUCKET:
        return None
    try:
        response = _get_s3_client().get_object(Bucket=settings.STORYBOARD_IMAGE_S3_BUCKET, Key=s3_key)
        raw_bytes = response["Body"].read()
        mime_type = mimetypes.guess_type(s3_key)[0] or "image/png"
        return mime_type, raw_bytes
    except Exception:
        return None


def _extract_image_bytes(response_json: dict) -> bytes:
    for candidate in response_json.get("candidates", []):
        content = candidate.get("content", {})
        for part in content.get("parts", []):
            inline_data = part.get("inlineData") or part.get("inline_data")
            if not inline_data:
                continue
            data = inline_data.get("data")
            if data:
                return base64.b64decode(data)
    finish_reasons = [
        candidate.get("finishReason") or candidate.get("finish_reason")
        for candidate in response_json.get("candidates", [])
    ]
    text_parts: list[str] = []
    for candidate in response_json.get("candidates", []):
        content = candidate.get("content", {})
        for part in content.get("parts", []):
            text_value = part.get("text")
            if text_value:
                text_parts.append(text_value.strip())
    text_preview = " | ".join(part for part in text_parts if part)[:500]
    raise ValueError(
        "Gemini image generation returned no image data. "
        f"finishReasons={finish_reasons} textPreview={text_preview!r}"
    )


def _extract_gemini_usage(response_json: dict) -> StoryboardImageUsage:
    usage_metadata = response_json.get("usageMetadata", {})
    prompt_tokens = _optional_int(usage_metadata.get("promptTokenCount"))
    candidate_tokens = _optional_int(usage_metadata.get("candidatesTokenCount"))
    total_tokens = _optional_int(usage_metadata.get("totalTokenCount"))
    if total_tokens is None and prompt_tokens is not None and candidate_tokens is not None:
        total_tokens = prompt_tokens + candidate_tokens
    return StoryboardImageUsage(
        provider="google",
        model=settings.STORYBOARD_IMAGE_MODEL,
        promptTokens=prompt_tokens,
        candidateTokens=candidate_tokens,
        totalTokens=total_tokens,
        imageCount=1,
        costUsd=_estimate_gemini_image_cost_usd(
            prompt_tokens=prompt_tokens,
            image_count=1,
        ),
    )


def _estimate_gemini_image_cost_usd(
    prompt_tokens: int | None,
    image_count: int,
) -> float | None:
    if prompt_tokens is None:
        return None
    input_cost = prompt_tokens * settings.STORYBOARD_IMAGE_INPUT_COST_PER_1M / 1_000_000
    output_cost = image_count * settings.STORYBOARD_IMAGE_OUTPUT_COST_PER_IMAGE
    return round(input_cost + output_cost, 6)


def _upload_and_resolve_url(
    story_id: int,
    item: StoryboardImageGenerateItemRequest,
    image_bytes: bytes,
    output_version: int | None = None,
) -> str:
    object_path = _storyboard_image_object_path(story_id, item.pageNumber, output_version)
    if _has_s3_upload_config():
        _upload_to_s3(object_path, image_bytes)
        return _resolve_public_url(object_path)

    public_url = _join_base_url(settings.STORYBOARD_IMAGE_PUBLIC_BASE_URL, object_path)
    if public_url:
        return public_url
    return f"local://storyboard-images/{object_path}"


def _storyboard_image_object_path(story_id: int, page_number: int, output_version: int | None = None) -> str:
    """env-prefixed `{env}/stories/{story_id}/storyboard-image/{page_number}/v{version}.png`."""
    version = output_version or 1
    return _apply_env_prefix(f"stories/{story_id}/storyboard-image/{page_number}/v{version}.png")


def _upload_and_resolve_character_reference_url(story_id: int, image_bytes: bytes) -> str:
    object_path = _character_reference_object_path(story_id)
    if _has_s3_upload_config():
        _upload_to_s3(object_path, image_bytes)
        return _resolve_public_url(object_path)

    public_url = _join_base_url(settings.STORYBOARD_IMAGE_PUBLIC_BASE_URL, object_path)
    if public_url:
        return public_url
    return f"local://storyboard-images/{object_path}"


def _aggregate_usage(results: list[StoryboardImageGenerateResult]) -> StoryboardImageBatchUsage:
    total_prompt_tokens = 0
    total_candidate_tokens = 0
    total_tokens = 0
    total_cost = 0.0

    has_prompt_tokens = False
    has_candidate_tokens = False
    has_total_tokens = False
    has_cost = False

    for result in results:
        usage = result.usage
        if usage.promptTokens is not None:
            total_prompt_tokens += usage.promptTokens
            has_prompt_tokens = True
        if usage.candidateTokens is not None:
            total_candidate_tokens += usage.candidateTokens
            has_candidate_tokens = True
        if usage.totalTokens is not None:
            total_tokens += usage.totalTokens
            has_total_tokens = True
        if usage.costUsd is not None:
            total_cost += usage.costUsd
            has_cost = True

    provider = results[0].usage.provider if results else "google"
    model = results[0].usage.model if results else settings.STORYBOARD_IMAGE_MODEL
    return StoryboardImageBatchUsage(
        provider=provider,
        model=model,
        totalPromptTokens=total_prompt_tokens if has_prompt_tokens else None,
        totalCandidateTokens=total_candidate_tokens if has_candidate_tokens else None,
        totalTokens=total_tokens if has_total_tokens else None,
        totalImages=sum(result.usage.imageCount for result in results),
        totalCostUsd=round(total_cost, 6) if has_cost else None,
    )


def _optional_int(value: object) -> int | None:
    return int(value) if value is not None else None


def _join_base_url(base_url: str | None, object_path: str) -> str | None:
    if not base_url:
        return None
    return f"{base_url.rstrip('/')}/{object_path}"


def _has_s3_upload_config() -> bool:
    return all(
        [
            settings.STORYBOARD_IMAGE_S3_BUCKET,
            settings.STORYBOARD_IMAGE_S3_REGION,
            settings.STORYBOARD_IMAGE_S3_ACCESS_KEY_ID,
            settings.STORYBOARD_IMAGE_S3_SECRET_ACCESS_KEY,
        ]
    )


def _upload_to_s3(object_path: str, image_bytes: bytes) -> None:
    try:
        _get_s3_client().put_object(
            Bucket=settings.STORYBOARD_IMAGE_S3_BUCKET,
            Key=object_path,
            Body=image_bytes,
            ContentType="image/png",
        )
    except Exception as exc:
        raise RuntimeError(f"S3 image upload failed: {exc}") from exc


def _resolve_public_url(object_path: str) -> str:
    if settings.STORYBOARD_IMAGE_PUBLIC_BASE_URL:
        return _join_base_url(settings.STORYBOARD_IMAGE_PUBLIC_BASE_URL, object_path) or object_path
    if settings.STORYBOARD_IMAGE_S3_ENDPOINT_URL:
        endpoint = settings.STORYBOARD_IMAGE_S3_ENDPOINT_URL.rstrip("/")
        bucket = settings.STORYBOARD_IMAGE_S3_BUCKET
        return f"{endpoint}/{bucket}/{object_path}"
    bucket = settings.STORYBOARD_IMAGE_S3_BUCKET
    region = settings.STORYBOARD_IMAGE_S3_REGION
    return f"https://{bucket}.s3.{region}.amazonaws.com/{object_path}"
