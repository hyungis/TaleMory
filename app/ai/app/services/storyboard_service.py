import json
import base64
import mimetypes
from itertools import cycle, islice

from app.core.config import settings
from app.schemas.storyboard import (
    PhotoInput,
    ReadingLevel,
    StoryboardGenerateRequest,
    StoryboardGenerateResponse,
    StoryboardPage,
    StoryboardRegenerateRequest,
    StorySentence,
    UsageInfo,
)
from app.services.storyboard_prompt import (
    STORYBOARD_PROMPT_TEMPLATE_VERSION,
    STORYBOARD_SYSTEM_PROMPT,
)

FIXED_PAGE_MIN = 10
FIXED_PAGE_MAX = 20
FIXED_MAGIC_LEVEL = "FANTASY"
FIXED_USE_VISION = True
FIXED_VISION_DETAIL = "low"


def generate_storyboard(request: StoryboardGenerateRequest) -> StoryboardGenerateResponse:
    if settings.OPENAI_API_KEY:
        return _generate_with_openai(request)
    return _generate_locally(request)


def regenerate_storyboard(request: StoryboardRegenerateRequest) -> StoryboardGenerateResponse:
    if settings.OPENAI_API_KEY:
        return _regenerate_with_openai(request)
    return _generate_locally(_build_regenerate_fallback_request(request))


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


def _build_openai_input_content(request: StoryboardGenerateRequest, payload: dict) -> list[dict[str, str]]:
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
        {
            "type": "input_text",
            "text": json.dumps(payload, ensure_ascii=False),
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


def _build_openai_regenerate_input_content(
    request: StoryboardRegenerateRequest,
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
    if not FIXED_USE_VISION:
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


def _reconcile_derived_counts(parsed: StoryboardGenerateResponse) -> None:
    for page_index, page in enumerate(parsed.pages, start=1):
        page.pageNumber = page_index
        for sentence_index, sentence in enumerate(page.sentences, start=1):
            sentence.sentenceOrder = sentence_index
        page.sentenceCount = len(page.sentences)
        page.wordCount = _count_words(page.englishText)
    parsed.pageCount = len(parsed.pages)
    parsed.totalWordCount = sum(page.wordCount for page in parsed.pages)


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


def _download_photo_bytes_from_s3(s3_key: str) -> bytes:
    if not settings.AWS_S3_BUCKET:
        raise RuntimeError("AWS_S3_BUCKET is not configured")

    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError("boto3 package is required to load storyboard source photos from S3") from exc

    client_kwargs: dict[str, object] = {}
    if settings.AWS_REGION:
        client_kwargs["region_name"] = settings.AWS_REGION
    if settings.AWS_ACCESS_KEY_ID:
        client_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
    if settings.AWS_SECRET_ACCESS_KEY:
        client_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    client = boto3.client("s3", **client_kwargs)
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
    premise = _build_local_premise(main_child, companion_text, request.travel.place, sorted_photos)

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

    title = f"{main_child}'s Little Trip to {request.travel.place}"
    synopsis = (
        f"{main_child} visits {request.travel.place} with {companion_text}. "
        "A shy sunbeam seems to guide the family from one small brave step to the next, "
        "teaching that courage grows through kindness and love."
    )
    response = StoryboardGenerateResponse(
        title=title,
        synopsis=synopsis,
        moralTheme="Courage grows through small kind steps.",
        storyQuest="Find where courage hides during the family trip.",
        recurringMotif="A shy sunbeam that appears whenever the child takes a brave or kind step.",
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


def _build_local_premise(child_name: str, companion_text: str, travel_place: str, photos: list) -> str:
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
        "A rough children's book storyboard sketch, warm and gentle, "
        f"featuring {child_name} at {travel_place}. Scene: {scene_summary}. "
        f"Visual hints: {hashtag_text}."
    )
