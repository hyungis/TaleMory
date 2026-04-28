import base64
import json
import time
from urllib import error, parse, request

from app.core.config import settings
from app.schemas.final_illustration import (
    FinalIllustrationBatchUsage,
    FinalIllustrationGenerateItemRequest,
    FinalIllustrationGenerateRequest,
    FinalIllustrationGenerateResponse,
    FinalIllustrationGenerateResult,
    FinalIllustrationRenderOptions,
    FinalIllustrationReviseRequest,
    FinalIllustrationReviseResponse,
    FinalIllustrationUsage,
)
from app.services.storyboard_image_service import (
    _download_reference_image,
    _download_reference_image_from_s3,
    _has_s3_upload_config,
    _join_base_url,
    _optional_int,
    _resolve_public_url,
    _upload_to_s3,
)

_ONE_PIXEL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn8J9sAAAAASUVORK5CYII="
)
_REPLICATE_API_BASE = "https://api.replicate.com/v1"
_REPLICATE_POLL_INTERVAL_SECONDS = 1.5
_REPLICATE_TIMEOUT_SECONDS = 300


def generate_final_illustrations(request_model: FinalIllustrationGenerateRequest) -> FinalIllustrationGenerateResponse:
    results: list[FinalIllustrationGenerateResult] = []

    for item in request_model.items:
        results.append(
            generate_final_illustration_item(
                story_id=request_model.storyId,
                item=item,
                seed=request_model.seed,
                render_options=request_model.renderOptions,
            )
        )

    return FinalIllustrationGenerateResponse(
        storyId=request_model.storyId,
        seed=request_model.seed,
        results=results,
        usage=_aggregate_usage(results),
    )


def revise_final_illustration(
    request_model: FinalIllustrationReviseRequest,
) -> FinalIllustrationReviseResponse:
    revise_item = _build_revise_item(request_model.item, request_model.userPrompt)
    result = generate_final_illustration_item(
        story_id=request_model.storyId,
        item=revise_item,
        seed=request_model.seed,
        render_options=request_model.renderOptions,
    )
    return FinalIllustrationReviseResponse(
        storyId=request_model.storyId,
        seed=request_model.seed,
        result=result,
    )


def generate_final_illustration_item(
    story_id: int,
    item: FinalIllustrationGenerateItemRequest,
    seed: int,
    render_options: FinalIllustrationRenderOptions,
) -> FinalIllustrationGenerateResult:
    if settings.REPLICATE_API_TOKEN:
        return _generate_item_with_replicate(story_id, item, seed, render_options)
    return _generate_item_locally(story_id, item)


def _generate_item_with_replicate(
    story_id: int,
    item: FinalIllustrationGenerateItemRequest,
    seed: int,
    render_options: FinalIllustrationRenderOptions,
) -> FinalIllustrationGenerateResult:
    final_prompt = _build_final_prompt(item)
    replicate_input = _build_replicate_input(item, seed, render_options, final_prompt)
    prediction = _create_and_wait_for_prediction(replicate_input)
    output_urls = _extract_prediction_output_urls(prediction)
    if not output_urls:
        raise ValueError("Replicate final illustration generation returned no output images.")

    image_bytes = _download_generated_image_bytes(output_urls[0])
    image_url = _upload_and_resolve_url(story_id, item, image_bytes)
    usage = _extract_replicate_usage(prediction, len(output_urls))
    return FinalIllustrationGenerateResult(
        pageNumber=item.pageNumber,
        imageUrl=image_url,
        usage=usage,
    )


def _generate_item_locally(
    story_id: int,
    item: FinalIllustrationGenerateItemRequest,
) -> FinalIllustrationGenerateResult:
    image_url = _upload_and_resolve_url(story_id, item, _ONE_PIXEL_PNG)
    return FinalIllustrationGenerateResult(
        pageNumber=item.pageNumber,
        imageUrl=image_url,
        usage=FinalIllustrationUsage(
            provider="local",
            model=settings.FINAL_ILLUSTRATION_MODEL,
            promptTokens=0,
            candidateTokens=0,
            totalTokens=0,
            imageCount=1,
            costUsd=0.0,
        ),
    )


def _build_revise_item(
    item: FinalIllustrationGenerateItemRequest,
    user_prompt: str,
) -> FinalIllustrationGenerateItemRequest:
    instruction_parts: list[str] = []
    if item.additionalInstruction:
        instruction_parts.append(item.additionalInstruction.strip())
    instruction_parts.append(f"User revision request: {user_prompt.strip()}")
    base_image_s3_key = item.currentIllustrationImageS3Key or item.roughStoryboardImageS3Key
    base_image_url = item.roughStoryboardImageUrl if base_image_s3_key is None else None
    return item.model_copy(
        update={
            "roughStoryboardImageS3Key": base_image_s3_key,
            "roughStoryboardImageUrl": base_image_url,
            "additionalInstruction": "\n".join(instruction_parts),
        }
    )


def _build_final_prompt(item: FinalIllustrationGenerateItemRequest) -> str:
    additional_instruction = item.additionalInstruction.strip() if item.additionalInstruction else "None"

    return "\n".join(
        [
            "Style prompt:",
            item.stylePrompt,
            "",
            "Create a finished full-color children's book illustration.",
            "Follow image 1 as closely as possible without changing the scene, composition, framing, camera angle, character placement, pose, scale, object placement, or story action.",
            "Apply only the rendering style from the style prompt.",
            "Do not add or remove visual elements.",
            "Absolutely no visible text anywhere in the image.",
            f"Scene summary: {item.page.sceneSummary}",
            f"Scene intent: {item.page.imagePrompt}",
            f"Additional instruction: {additional_instruction}",
        ]
    )


def _build_replicate_input(
    item: FinalIllustrationGenerateItemRequest,
    seed: int,
    render_options: FinalIllustrationRenderOptions,
    final_prompt: str,
) -> dict:
    payload = {
        "prompt": final_prompt,
        "images": _collect_reference_images(item),
        "aspect_ratio": render_options.aspectRatio,
        "megapixels": render_options.megapixels,
        "output_format": render_options.outputFormat,
        "output_quality": render_options.outputQuality,
        "num_outputs": render_options.numOutputs,
        "go_fast": render_options.goFast,
        "safety_tolerance": render_options.safetyTolerance,
        "disable_safety_checker": render_options.disableSafetyChecker,
    }
    if seed > 0:
        payload["seed"] = seed
    return payload


def _collect_reference_images(item: FinalIllustrationGenerateItemRequest) -> list[str]:
    images: list[str] = []
    rough_reference = _resolve_reference_string(item.roughStoryboardImageUrl, item.roughStoryboardImageS3Key)
    if rough_reference:
        images.append(rough_reference)

    if not images:
        raise ValueError("At least one rough storyboard reference image is required.")
    return images


def _resolve_reference_string(image_url: str | None, s3_key: str | None) -> str | None:
    if image_url:
        return image_url
    if not s3_key:
        return None

    public_url = _resolve_story_asset_url(s3_key)
    if public_url:
        return public_url

    downloaded = _download_reference_image_from_s3(s3_key)
    if downloaded is None:
        return None
    mime_type, raw_bytes = downloaded
    return f"data:{mime_type};base64,{base64.b64encode(raw_bytes).decode('ascii')}"


def _resolve_story_asset_url(s3_key: str) -> str | None:
    public_url = _join_base_url(settings.STORYBOARD_IMAGE_PUBLIC_BASE_URL, s3_key)
    if public_url:
        return public_url
    try:
        return _resolve_public_url(s3_key)
    except Exception:
        return None


def _create_and_wait_for_prediction(replicate_input: dict) -> dict:
    prediction = _create_prediction(replicate_input)
    deadline = time.time() + _REPLICATE_TIMEOUT_SECONDS

    while prediction.get("status") in {"starting", "processing"}:
        if time.time() >= deadline:
            raise RuntimeError("Replicate final illustration generation timed out.")
        time.sleep(_REPLICATE_POLL_INTERVAL_SECONDS)
        prediction = _fetch_prediction(prediction)

    status = prediction.get("status")
    if status == "succeeded":
        return prediction
    if status in {"failed", "canceled"}:
        error_message = prediction.get("error") or f"Replicate prediction ended with status={status}"
        raise ValueError(f"Replicate final illustration generation failed: {error_message}")
    raise RuntimeError(f"Unexpected Replicate prediction status: {status}")


def _create_prediction(replicate_input: dict) -> dict:
    payload = {"input": replicate_input}
    api_url = f"{_REPLICATE_API_BASE}/models/{_quote_model_path(settings.FINAL_ILLUSTRATION_MODEL)}/predictions"
    return _replicate_request(api_url, payload, method="POST")


def _fetch_prediction(prediction: dict) -> dict:
    poll_url = prediction.get("urls", {}).get("get")
    if not poll_url:
        prediction_id = prediction.get("id")
        if not prediction_id:
            raise RuntimeError("Replicate prediction response did not include a polling URL or prediction id.")
        poll_url = f"{_REPLICATE_API_BASE}/predictions/{prediction_id}"
    return _replicate_request(poll_url, payload=None, method="GET")


def _replicate_request(api_url: str, payload: dict | None, method: str) -> dict:
    if not settings.REPLICATE_API_TOKEN:
        raise RuntimeError("REPLICATE_API_TOKEN is not configured")

    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = request.Request(
        api_url,
        data=data,
        headers={
            "Authorization": f"Bearer {settings.REPLICATE_API_TOKEN}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with request.urlopen(req, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"Replicate API request failed: {exc.code} {body}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"Replicate API network error: {exc.reason}") from exc


def _quote_model_path(model_path: str) -> str:
    owner, name = model_path.split("/", 1)
    return f"{parse.quote(owner)}/{parse.quote(name)}"


def _extract_prediction_output_urls(prediction: dict) -> list[str]:
    output = prediction.get("output")
    if isinstance(output, list):
        return [value for value in output if isinstance(value, str) and value]
    if isinstance(output, str) and output:
        return [output]
    return []


def _download_generated_image_bytes(image_url: str) -> bytes:
    downloaded = _download_reference_image(image_url)
    if downloaded is None:
        raise RuntimeError(f"Failed to download generated illustration from {image_url}")
    _, raw_bytes = downloaded
    return raw_bytes


def _upload_and_resolve_url(story_id: int, item: FinalIllustrationGenerateItemRequest, image_bytes: bytes) -> str:
    object_path = f"stories/{story_id}/final-illustration/{item.pageNumber}.png"
    if _has_s3_upload_config():
        _upload_to_s3(object_path, image_bytes)
        return _resolve_final_public_url(object_path)

    public_url = _join_base_url(settings.STORYBOARD_IMAGE_PUBLIC_BASE_URL, object_path)
    if public_url:
        return public_url
    return f"local://final-illustrations/{object_path}"


def _resolve_final_public_url(object_path: str) -> str:
    if settings.STORYBOARD_IMAGE_PUBLIC_BASE_URL:
        return _join_base_url(settings.STORYBOARD_IMAGE_PUBLIC_BASE_URL, object_path) or object_path
    return _resolve_public_url(object_path)


def _extract_replicate_usage(prediction: dict, image_count: int) -> FinalIllustrationUsage:
    metrics = prediction.get("metrics", {})
    total_tokens = _optional_int(metrics.get("total_tokens"))
    predicted_seconds = metrics.get("predict_time")
    return FinalIllustrationUsage(
        provider="replicate",
        model=settings.FINAL_ILLUSTRATION_MODEL,
        promptTokens=None,
        candidateTokens=None,
        totalTokens=total_tokens,
        imageCount=image_count,
        costUsd=float(predicted_seconds) if predicted_seconds is not None else None,
    )


def _aggregate_usage(results: list[FinalIllustrationGenerateResult]) -> FinalIllustrationBatchUsage:
    total_tokens = 0
    total_cost = 0.0
    has_total_tokens = False
    has_cost = False

    for result in results:
        usage = result.usage
        if usage.totalTokens is not None:
            total_tokens += usage.totalTokens
            has_total_tokens = True
        if usage.costUsd is not None:
            total_cost += usage.costUsd
            has_cost = True

    return FinalIllustrationBatchUsage(
        provider=results[0].usage.provider if results else "replicate",
        model=results[0].usage.model if results else settings.FINAL_ILLUSTRATION_MODEL,
        totalPromptTokens=None,
        totalCandidateTokens=None,
        totalTokens=total_tokens if has_total_tokens else None,
        totalImages=sum(result.usage.imageCount for result in results),
        totalCostUsd=round(total_cost, 6) if has_cost else None,
    )
