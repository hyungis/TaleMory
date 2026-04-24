import base64
import json
import mimetypes
from urllib import error, parse, request

from app.core.config import settings
from app.schemas.storyboard_image import (
    StoryboardImageBatchUsage,
    StoryboardImageGenerateItemRequest,
    StoryboardImageGenerateRequest,
    StoryboardImageGenerateResponse,
    StoryboardImageGenerateResult,
    StoryboardImageUsage,
)

_ONE_PIXEL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn8J9sAAAAASUVORK5CYII="
)
def generate_storyboard_images(request_model: StoryboardImageGenerateRequest) -> StoryboardImageGenerateResponse:
    results: list[StoryboardImageGenerateResult] = []
    storyboard_seed = request_model.seed

    for item in request_model.items:
        if settings.GEMINI_API_KEY:
            results.append(_generate_item_with_gemini(request_model.storyId, item, storyboard_seed))
        else:
            results.append(_generate_item_locally(request_model.storyId, item))

    return StoryboardImageGenerateResponse(
        storyId=request_model.storyId,
        seed=storyboard_seed,
        results=results,
        usage=_aggregate_usage(results),
    )


def _generate_item_with_gemini(
    story_id: int,
    item: StoryboardImageGenerateItemRequest,
    seed: int,
) -> StoryboardImageGenerateResult:
    final_prompt = _build_final_prompt(item)
    response_json = _call_gemini_image_api(final_prompt, item.referenceImageUrls, seed)
    image_bytes = _extract_image_bytes(response_json)
    image_url = _upload_and_resolve_url(story_id, item, image_bytes)
    usage = _extract_gemini_usage(response_json)
    return StoryboardImageGenerateResult(
        pageNumber=item.pageNumber,
        imageUrl=image_url,
        usage=usage,
    )


def _generate_item_locally(
    story_id: int,
    item: StoryboardImageGenerateItemRequest,
) -> StoryboardImageGenerateResult:
    image_url = _upload_and_resolve_url(story_id, item, _ONE_PIXEL_PNG)
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


def _build_final_prompt(item: StoryboardImageGenerateItemRequest) -> str:
    child_descriptions = ", ".join(
        f"{child.name} ({child.age}, {child.gender.lower()})" for child in item.children
    )
    companions = ", ".join(item.companions) if item.companions else "family"
    parts = [
        "Create a rough children's storybook sketch just before the coloring stage.",
        f"Story title: {item.storyboard.title}",
        f"Story synopsis: {item.storyboard.synopsis}",
        f"Moral theme: {item.storyboard.moralTheme}",
        f"Recurring motif: {item.storyboard.recurringMotif}",
        f"Page {item.pageNumber} scene summary: {item.page.sceneSummary}",
        f"Page English text: {item.page.englishText}",
        f"Page Korean text: {item.page.koreanText}",
        f"Base image prompt: {item.page.imagePrompt}",
        f"Main children: {child_descriptions}",
        f"Companions in scene: {companions}",
        (
            "Visual direction: loose pencil-and-ink storyboard sketch, rough hand-drawn linework, "
            "minimal flat shading, no polished final rendering, expressive faces, clean composition, "
            "child-safe tone."
        ),
        (
            "Do not render any words, letters, captions, subtitles, speech bubbles, sound effects, "
            "or typographic elements inside the image."
        ),
    ]
    if item.referenceImageUrls:
        parts.append(
            "Reference images are provided to preserve the travel mood and character consistency where possible."
        )
    if item.additionalInstruction:
        parts.append(f"Additional instruction: {item.additionalInstruction}")
    return "\n".join(parts)


def _call_gemini_image_api(final_prompt: str, reference_image_urls: list[str], seed: int) -> dict:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    api_url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.STORYBOARD_IMAGE_MODEL}:generateContent?key={parse.quote(settings.GEMINI_API_KEY)}"
    )
    parts = _build_gemini_parts(final_prompt, reference_image_urls)
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


def _build_gemini_parts(final_prompt: str, reference_image_urls: list[str]) -> list[dict]:
    parts: list[dict] = []
    for image_url in reference_image_urls[:3]:
        downloaded = _download_reference_image(image_url)
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
    parts.append({"text": final_prompt})
    return parts


def _build_gemini_generation_config(seed: int) -> dict:
    return {
        "responseModalities": ["TEXT", "IMAGE"],
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
    raise ValueError("Gemini image generation returned no image data")


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
        costUsd=None,
    )


def _upload_and_resolve_url(
    story_id: int,
    item: StoryboardImageGenerateItemRequest,
    image_bytes: bytes,
) -> str:
    object_path = f"stories/{story_id}/storyboard-image/{item.pageNumber}.png"
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
        import boto3
    except ImportError as exc:
        raise RuntimeError("boto3 package is not installed") from exc

    session = boto3.session.Session(
        aws_access_key_id=settings.STORYBOARD_IMAGE_S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.STORYBOARD_IMAGE_S3_SECRET_ACCESS_KEY,
        region_name=settings.STORYBOARD_IMAGE_S3_REGION,
    )
    client = session.client("s3", endpoint_url=settings.STORYBOARD_IMAGE_S3_ENDPOINT_URL)
    try:
        client.put_object(
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
