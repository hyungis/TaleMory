import base64
from concurrent.futures import ThreadPoolExecutor
import json
from urllib import error, parse, request

from pydantic import ValidationError

from app.core.config import settings
from app.schemas.final_illustration import (
    FinalIllustrationLayoutAnalysisBatchRequest,
    FinalIllustrationLayoutAnalysisBatchResponse,
    FinalIllustrationLayoutAnalysisRequest,
    FinalIllustrationLayoutAnalysisResponse,
)
from app.services.storyboard_image_service import (
    _download_reference_image,
    _download_reference_image_from_s3,
    _resolve_public_url,
)


def analyze_final_illustration_layout(
    request_model: FinalIllustrationLayoutAnalysisRequest,
) -> FinalIllustrationLayoutAnalysisResponse:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    model = settings.FINAL_ILLUSTRATION_LAYOUT_MODEL
    response = _call_gemini_layout_api(request_model, model)
    data = _extract_gemini_json(response)
    data.setdefault("pageNumber", request_model.pageNumber)
    data.setdefault("model", model)
    try:
        parsed = FinalIllustrationLayoutAnalysisResponse.model_validate(data)
    except ValidationError as exc:
        raise ValueError(f"Gemini layout analysis returned invalid JSON: {exc}") from exc
    return parsed.model_copy(update={"model": model})


def analyze_final_illustration_layouts(
    request_model: FinalIllustrationLayoutAnalysisBatchRequest,
) -> FinalIllustrationLayoutAnalysisBatchResponse:
    max_workers = min(20, len(request_model.items))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        results = list(executor.map(analyze_final_illustration_layout, request_model.items))
    return FinalIllustrationLayoutAnalysisBatchResponse(results=results)


def _call_gemini_layout_api(request_model: FinalIllustrationLayoutAnalysisRequest, model: str) -> dict:
    api_url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={parse.quote(settings.GEMINI_API_KEY)}"
    )
    payload = {
        "contents": [{"parts": _build_gemini_layout_parts(request_model)}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
            "responseSchema": _layout_response_schema(),
        },
    }
    req = request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"Gemini layout analysis failed: {exc.code} {body}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"Gemini layout analysis network error: {exc.reason}") from exc


def _build_gemini_layout_parts(request_model: FinalIllustrationLayoutAnalysisRequest) -> list[dict]:
    mime_type, raw_bytes = _load_layout_image(request_model)
    return [
        {
            "inlineData": {
                "mimeType": mime_type,
                "data": base64.b64encode(raw_bytes).decode("ascii"),
            }
        },
        {"text": _build_layout_prompt(request_model)},
    ]


def _load_layout_image(request_model: FinalIllustrationLayoutAnalysisRequest) -> tuple[str, bytes]:
    if request_model.imageS3Key:
        downloaded = _download_reference_image_from_s3(request_model.imageS3Key)
        if downloaded is not None:
            return downloaded
        public_url = _resolve_public_url(request_model.imageS3Key)
        downloaded = _download_reference_image(public_url)
        if downloaded is not None:
            return downloaded

    if request_model.imageUrl:
        downloaded = _download_reference_image(request_model.imageUrl)
        if downloaded is not None:
            return downloaded

    raise ValueError("Failed to load final illustration image for layout analysis.")


def _build_layout_prompt(request_model: FinalIllustrationLayoutAnalysisRequest) -> str:
    children = [child.model_dump(mode="json") for child in request_model.children]
    sentences = [sentence.model_dump(mode="json") for sentence in request_model.sentences]
    speaker_keys = sorted({sentence.speakerKey for sentence in request_model.sentences if sentence.speakerKey})
    return "\n".join(
        [
            "Analyze the final children's illustration image.",
            "Return only JSON that matches the provided schema.",
            "Use normalized coordinates from 0 to 1 relative to the full image.",
            "Coordinate rules: x/y are the top-left corner. width/height are box size.",
            "Only find character anchors for characters who are speakers in Sentences JSON.",
            "Speaker keys to locate: " + (", ".join(speaker_keys) if speaker_keys else "none"),
            "If there are no speaker keys, return an empty characters array.",
            "For each speaker character, return a tight bbox around the full visible character.",
            "For each speaker character anchor, use the point just above the top of the character's head.",
            "The anchor should be horizontally centered on the head and slightly above the hair/head outline, still within the image bounds.",
            "Do not return speech bubble coordinates.",
            "Narration placement and speech bubble placement are handled by the client.",
            "If a target is uncertain, lower confidence instead of inventing exact certainty.",
            "",
            f"Page number: {request_model.pageNumber}",
            f"Scene summary: {request_model.sceneSummary or ''}",
            f"Image prompt: {request_model.imagePrompt or ''}",
            "Known children JSON:",
            json.dumps(children, ensure_ascii=False),
            "Webtoon charactersInScene JSON:",
            json.dumps(request_model.charactersInScene, ensure_ascii=False),
            "Companions JSON:",
            json.dumps(request_model.companions, ensure_ascii=False),
            "Sentences JSON:",
            json.dumps(sentences, ensure_ascii=False),
        ]
    )


def _extract_gemini_json(response: dict) -> dict:
    candidates = response.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise ValueError("Gemini layout analysis returned no candidates.")
    parts = candidates[0].get("content", {}).get("parts", [])
    texts = [part.get("text") for part in parts if isinstance(part, dict) and isinstance(part.get("text"), str)]
    if not texts:
        raise ValueError("Gemini layout analysis returned no text JSON.")
    try:
        return json.loads("\n".join(texts))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Gemini layout analysis returned malformed JSON: {texts[0]}") from exc


def _layout_response_schema() -> dict:
    bbox_schema = {
        "type": "OBJECT",
        "properties": {
            "x": {"type": "NUMBER"},
            "y": {"type": "NUMBER"},
            "width": {"type": "NUMBER"},
            "height": {"type": "NUMBER"},
        },
        "required": ["x", "y", "width", "height"],
        "propertyOrdering": ["x", "y", "width", "height"],
    }
    anchor_schema = {
        "type": "OBJECT",
        "properties": {
            "x": {"type": "NUMBER"},
            "y": {"type": "NUMBER"},
        },
        "required": ["x", "y"],
        "propertyOrdering": ["x", "y"],
    }
    character_schema = {
        "type": "OBJECT",
        "properties": {
            "name": {"type": "STRING"},
            "bbox": bbox_schema,
            "anchor": anchor_schema,
            "confidence": {"type": "NUMBER"},
        },
        "required": ["name", "bbox", "anchor", "confidence"],
        "propertyOrdering": ["name", "bbox", "anchor", "confidence"],
    }
    return {
        "type": "OBJECT",
        "properties": {
            "pageNumber": {"type": "INTEGER"},
            "model": {"type": "STRING"},
            "characters": {"type": "ARRAY", "items": character_schema},
        },
        "required": ["pageNumber", "characters"],
        "propertyOrdering": ["pageNumber", "model", "characters"],
    }
