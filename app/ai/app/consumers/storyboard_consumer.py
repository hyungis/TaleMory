import json
import logging
from typing import Any

from app.core.config import settings
from app.mq.client import create_channel, create_connection, declare_ai_topology
from app.mq.publisher import StoryResultPublisher
from app.schemas.mq_story_sentence_translation import StorySentenceTranslationJobMessage
from app.schemas.mq_storyboard import StoryError, StoryGenerateJobMessage, StoryRegenerateJobMessage
from app.schemas.mq_storyboard_summary import (
    StorySummaryGenerateJobMessage,
    StorySummaryRegenerateJobMessage,
)
from app.schemas.storyboard import StoryboardGenerateRequest, StoryboardRegenerateRequest
from app.schemas.storyboard_summary import (
    StoryboardSummaryGenerateRequest,
    StoryboardSummaryRegenerateRequest,
)
from app.services.storyboard_summary_service import (
    generate_storyboard_summary,
    regenerate_storyboard_summary,
)
from app.services.storyboard_service import generate_storyboard, regenerate_storyboard
from app.services.story_sentence_translation_service import translate_story_sentences
from app.worker_async import ApiJob, publisher_channel, submit_story_api_message

logger = logging.getLogger(__name__)


def consume_storyboard_jobs() -> None:
    connection = create_connection()
    channel = create_channel(connection)
    declare_ai_topology(channel)
    register_storyboard_consumers(channel)
    try:
        channel.start_consuming()
    finally:
        if connection.is_open:
            connection.close()


def register_storyboard_consumers(channel: Any) -> None:
    channel.basic_consume(
        queue=settings.RABBITMQ_GENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_generate_message(
            ch, method.delivery_tag, body
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_SUMMARY_GENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_summary_generate_message(
            ch, method.delivery_tag, body
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_SUMMARY_REGENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_summary_regenerate_message(
            ch, method.delivery_tag, body
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_SENTENCE_TRANSLATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_sentence_translate_message(
            ch, method.delivery_tag, body
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_REGENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_regenerate_message(
            ch, method.delivery_tag, body
        ),
    )


def _dispatch_generate_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
) -> None:
    logger.info(
        "[STORY:GEN] dispatch — deliveryTag=%d, queue=%s, bytes=%d",
        delivery_tag, settings.RABBITMQ_GENERATE_QUEUE, len(body),
    )
    submit_story_api_message(
        consumer_channel=channel,
        delivery_tag=delivery_tag,
        job_factory=lambda: _create_generate_job(body),
        task_name="generate storyboard message",
    )


def _dispatch_summary_generate_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
) -> None:
    logger.info(
        "[SUMMARY:GEN] dispatch — deliveryTag=%d, queue=%s, bytes=%d",
        delivery_tag, settings.RABBITMQ_SUMMARY_GENERATE_QUEUE, len(body),
    )
    submit_story_api_message(
        consumer_channel=channel,
        delivery_tag=delivery_tag,
        job_factory=lambda: _create_summary_generate_job(body),
        task_name="generate storyboard summary message",
    )


def _dispatch_regenerate_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
) -> None:
    logger.info(
        "[STORY:REGEN] dispatch — deliveryTag=%d, queue=%s, bytes=%d",
        delivery_tag, settings.RABBITMQ_REGENERATE_QUEUE, len(body),
    )
    submit_story_api_message(
        consumer_channel=channel,
        delivery_tag=delivery_tag,
        job_factory=lambda: _create_regenerate_job(body),
        task_name="regenerate storyboard message",
    )


def _dispatch_sentence_translate_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
) -> None:
    logger.info(
        "[SENTENCE:TRANSLATE] dispatch deliveryTag=%d, queue=%s, bytes=%d",
        delivery_tag, settings.RABBITMQ_SENTENCE_TRANSLATE_QUEUE, len(body),
    )
    submit_story_api_message(
        consumer_channel=channel,
        delivery_tag=delivery_tag,
        job_factory=lambda: _create_sentence_translate_job(body),
        task_name="translate story sentences message",
    )


def _dispatch_summary_regenerate_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
) -> None:
    logger.info(
        "[SUMMARY:REGEN] dispatch — deliveryTag=%d, queue=%s, bytes=%d",
        delivery_tag, settings.RABBITMQ_SUMMARY_REGENERATE_QUEUE, len(body),
    )
    submit_story_api_message(
        consumer_channel=channel,
        delivery_tag=delivery_tag,
        job_factory=lambda: _create_summary_regenerate_job(body),
        task_name="regenerate storyboard summary message",
    )


def _create_generate_job(body: bytes) -> ApiJob:
    message = StoryGenerateJobMessage.model_validate_json(body)
    request = _merge_story_id_generate(message.storyId, message.payload)
    story_id = _story_id_from_generate(message.storyId, request)
    logger.info(
        "[STORY:GEN] received ??jobId=%s, storyId=%s, photos=%d, children=%d",
        message.jobId, story_id, len(request.photos), len(request.children),
    )
    return ApiJob(
        task=lambda: generate_storyboard(request),
        on_success=lambda result: _publish_story_result(message, story_id, result, "GENERATE"),
        on_error=lambda exc: _publish_story_failure(message, story_id, exc, "GENERATE"),
    )


def _create_summary_generate_job(body: bytes) -> ApiJob:
    message = StorySummaryGenerateJobMessage.model_validate_json(body)
    request = _merge_story_id_summary(message.storyId, message.payload)
    story_id = _story_id_from_summary(message.storyId, request)
    logger.info(
        "[SUMMARY:GEN] received ??jobId=%s, storyId=%s, photos=%d, children=%d",
        message.jobId, story_id, len(request.photos), len(request.children),
    )
    return ApiJob(
        task=lambda: generate_storyboard_summary(request),
        on_success=lambda result: _publish_summary_result(message, story_id, result, "GENERATE"),
        on_error=lambda exc: _publish_summary_failure(message, story_id, exc, "GENERATE"),
    )


def _create_sentence_translate_job(body: bytes) -> ApiJob:
    message = StorySentenceTranslationJobMessage.model_validate_json(body)
    logger.info(
        "[SENTENCE:TRANSLATE] received jobId=%s, storyId=%s, pageNumber=%s, koreanLen=%d",
        message.jobId, message.storyId, message.pageNumber, len(message.payload.koreanText),
    )
    return ApiJob(
        task=lambda: translate_story_sentences(message.payload),
        on_success=lambda result: _publish_sentence_translation_result(message, result),
        on_error=lambda exc: _publish_sentence_translation_failure(message, exc),
    )


def _create_regenerate_job(body: bytes) -> ApiJob:
    message = StoryRegenerateJobMessage.model_validate_json(body)
    request = _merge_story_id_regenerate(message.storyId, message.payload)
    story_id = _story_id_from_regenerate(message.storyId, request)
    logger.info(
        "[STORY:REGEN] received ??jobId=%s, storyId=%s",
        message.jobId, story_id,
    )
    return ApiJob(
        task=lambda: regenerate_storyboard(request),
        on_success=lambda result: _publish_story_result(message, story_id, result, "REGENERATE"),
        on_error=lambda exc: _publish_story_failure(message, story_id, exc, "REGENERATE"),
    )


def _create_summary_regenerate_job(body: bytes) -> ApiJob:
    message = StorySummaryRegenerateJobMessage.model_validate_json(body)
    request = _merge_story_id_summary_regenerate(message.storyId, message.payload)
    story_id = _story_id_from_summary_regenerate(message.storyId, request)
    logger.info(
        "[SUMMARY:REGEN] received ??jobId=%s, storyId=%s, userPromptLen=%d",
        message.jobId, story_id, len(request.userPrompt or ""),
    )
    return ApiJob(
        task=lambda: regenerate_storyboard_summary(request),
        on_success=lambda result: _publish_summary_result(message, story_id, result, "REGENERATE"),
        on_error=lambda exc: _publish_summary_failure(message, story_id, exc, "REGENERATE"),
    )


def _process_generate_message(body: bytes) -> bool:
    with publisher_channel() as channel:
        publisher = StoryResultPublisher(channel)
        handle_generate_message(body=body, publisher=publisher)
    return True


def _process_summary_generate_message(body: bytes) -> bool:
    with publisher_channel() as channel:
        publisher = StoryResultPublisher(channel)
        try:
            handle_summary_generate_message(body=body, publisher=publisher)
        except Exception as exc:
            logger.exception("Unexpected error while processing generate storyboard summary message")
            return _publish_unexpected_summary_failure(body=body, publisher=publisher, action="GENERATE", exc=exc)
    return True


def _process_regenerate_message(body: bytes) -> bool:
    with publisher_channel() as channel:
        publisher = StoryResultPublisher(channel)
        handle_regenerate_message(body=body, publisher=publisher)
    return True


def _process_summary_regenerate_message(body: bytes) -> bool:
    with publisher_channel() as channel:
        publisher = StoryResultPublisher(channel)
        try:
            handle_summary_regenerate_message(body=body, publisher=publisher)
        except Exception as exc:
            logger.exception("Unexpected error while processing regenerate storyboard summary message")
            return _publish_unexpected_summary_failure(body=body, publisher=publisher, action="REGENERATE", exc=exc)
    return True


def _publish_story_result(
    message: StoryGenerateJobMessage | StoryRegenerateJobMessage,
    story_id: int | None,
    result: Any,
    action: str,
) -> bool:
    with publisher_channel() as channel:
        publisher = StoryResultPublisher(channel)
        publisher.publish_result(
            job_id=message.jobId,
            story_id=story_id,
            payload=result,
            action=action,
        )
    if action == "GENERATE":
        logger.info(
            "[STORY:GEN] published result ??jobId=%s, pages=%d, totalWords=%s, costUsd=%s",
            message.jobId, len(result.pages), result.totalWordCount, result.usage.costUsd,
        )
    else:
        logger.info(
            "[STORY:REGEN] published result ??jobId=%s, pages=%d, costUsd=%s",
            message.jobId, len(result.pages), result.usage.costUsd,
        )
    return True


def _publish_story_failure(
    message: StoryGenerateJobMessage | StoryRegenerateJobMessage,
    story_id: int | None,
    exc: BaseException,
    action: str,
) -> bool:
    if isinstance(exc, ValueError):
        code = f"{action}_STORY_ERROR"
    elif isinstance(exc, RuntimeError):
        code = f"{action}_STORY_RUNTIME_ERROR"
    else:
        raise exc

    with publisher_channel() as channel:
        publisher = StoryResultPublisher(channel)
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=story_id,
            error=StoryError(code=code, message=str(exc)),
            action=action,
        )
    return True


def _publish_summary_result(
    message: StorySummaryGenerateJobMessage | StorySummaryRegenerateJobMessage,
    story_id: int | None,
    result: Any,
    action: str,
) -> bool:
    with publisher_channel() as channel:
        publisher = StoryResultPublisher(channel)
        publisher.publish_summary_result(
            job_id=message.jobId,
            story_id=story_id,
            payload=result,
            action=action,
        )
    logger.info(
        "[SUMMARY:%s] published result ??jobId=%s, summaryKoLen=%d, costUsd=%s",
        "GEN" if action == "GENERATE" else "REGEN",
        message.jobId, len(result.summaryKo), result.usage.costUsd,
    )
    return True


def _publish_sentence_translation_result(
    message: StorySentenceTranslationJobMessage,
    result: Any,
) -> bool:
    with publisher_channel() as channel:
        publisher = StoryResultPublisher(channel)
        publisher.publish_sentence_translation_result(
            job_id=message.jobId,
            story_id=message.storyId,
            page_number=message.pageNumber,
            payload=result,
        )
    logger.info(
        "[SENTENCE:TRANSLATE] published result jobId=%s, storyId=%s, pageNumber=%s, sentenceCount=%d, costUsd=%s",
        message.jobId, message.storyId, message.pageNumber, result.sentenceCount, result.usage.costUsd,
    )
    return True


def _publish_sentence_translation_failure(
    message: StorySentenceTranslationJobMessage,
    exc: BaseException,
) -> bool:
    if isinstance(exc, ValueError):
        code = "TRANSLATE_STORY_SENTENCES_ERROR"
    elif isinstance(exc, RuntimeError):
        code = "TRANSLATE_STORY_SENTENCES_RUNTIME_ERROR"
    else:
        raise exc

    with publisher_channel() as channel:
        publisher = StoryResultPublisher(channel)
        publisher.publish_sentence_translation_failure(
            job_id=message.jobId,
            story_id=message.storyId,
            page_number=message.pageNumber,
            error=StoryError(code=code, message=str(exc)),
        )
    return True


def _publish_summary_failure(
    message: StorySummaryGenerateJobMessage | StorySummaryRegenerateJobMessage,
    story_id: int | None,
    exc: BaseException,
    action: str,
) -> bool:
    if isinstance(exc, ValueError):
        code = f"{action}_STORY_SUMMARY_ERROR"
    elif isinstance(exc, RuntimeError):
        code = f"{action}_STORY_SUMMARY_RUNTIME_ERROR"
    else:
        with publisher_channel() as channel:
            publisher = StoryResultPublisher(channel)
            return _publish_unexpected_summary_failure(
                body=json.dumps({"jobId": message.jobId, "storyId": story_id}).encode("utf-8"),
                publisher=publisher,
                action=action,
                exc=exc,
            )

    with publisher_channel() as channel:
        publisher = StoryResultPublisher(channel)
        publisher.publish_summary_failure(
            job_id=message.jobId,
            story_id=story_id,
            error=StoryError(code=code, message=str(exc)),
            action=action,
        )
    return True


def handle_generate_message(body: bytes, publisher: StoryResultPublisher) -> None:
    message = StoryGenerateJobMessage.model_validate_json(body)
    request = _merge_story_id_generate(message.storyId, message.payload)
    story_id = _story_id_from_generate(message.storyId, request)
    logger.info(
        "[STORY:GEN] received — jobId=%s, storyId=%s, photos=%d, children=%d",
        message.jobId, story_id, len(request.photos), len(request.children),
    )

    try:
        result = generate_storyboard(request)
    except ValueError as exc:
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=story_id,
            error=StoryError(code="GENERATE_STORY_ERROR", message=str(exc)),
            action="GENERATE",
        )
        return
    except RuntimeError as exc:
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=story_id,
            error=StoryError(code="GENERATE_STORY_RUNTIME_ERROR", message=str(exc)),
            action="GENERATE",
        )
        return

    publisher.publish_result(
        job_id=message.jobId,
        story_id=story_id,
        payload=result,
        action="GENERATE",
    )
    logger.info(
        "[STORY:GEN] published result — jobId=%s, pages=%d, totalWords=%s, costUsd=%s",
        message.jobId, len(result.pages), result.totalWordCount, result.usage.costUsd,
    )


def handle_summary_generate_message(body: bytes, publisher: StoryResultPublisher) -> None:
    message = StorySummaryGenerateJobMessage.model_validate_json(body)
    request = _merge_story_id_summary(message.storyId, message.payload)
    story_id = _story_id_from_summary(message.storyId, request)
    logger.info(
        "[SUMMARY:GEN] received — jobId=%s, storyId=%s, photos=%d, children=%d",
        message.jobId, story_id, len(request.photos), len(request.children),
    )

    try:
        result = generate_storyboard_summary(request)
    except ValueError as exc:
        publisher.publish_summary_failure(
            job_id=message.jobId,
            story_id=story_id,
            error=StoryError(code="GENERATE_STORY_SUMMARY_ERROR", message=str(exc)),
        )
        return
    except RuntimeError as exc:
        publisher.publish_summary_failure(
            job_id=message.jobId,
            story_id=story_id,
            error=StoryError(code="GENERATE_STORY_SUMMARY_RUNTIME_ERROR", message=str(exc)),
        )
        return

    publisher.publish_summary_result(
        job_id=message.jobId,
        story_id=story_id,
        payload=result,
        action="GENERATE",
    )
    logger.info(
        "[SUMMARY:GEN] published result — jobId=%s, summaryKoLen=%d, costUsd=%s",
        message.jobId, len(result.summaryKo), result.usage.costUsd,
    )


def handle_summary_regenerate_message(body: bytes, publisher: StoryResultPublisher) -> None:
    message = StorySummaryRegenerateJobMessage.model_validate_json(body)
    request = _merge_story_id_summary_regenerate(message.storyId, message.payload)
    story_id = _story_id_from_summary_regenerate(message.storyId, request)
    logger.info(
        "[SUMMARY:REGEN] received — jobId=%s, storyId=%s, userPromptLen=%d",
        message.jobId, story_id, len(request.userPrompt or ""),
    )

    try:
        result = regenerate_storyboard_summary(request)
    except ValueError as exc:
        publisher.publish_summary_failure(
            job_id=message.jobId,
            story_id=story_id,
            error=StoryError(code="REGENERATE_STORY_SUMMARY_ERROR", message=str(exc)),
            action="REGENERATE",
        )
        return
    except RuntimeError as exc:
        publisher.publish_summary_failure(
            job_id=message.jobId,
            story_id=story_id,
            error=StoryError(code="REGENERATE_STORY_SUMMARY_RUNTIME_ERROR", message=str(exc)),
            action="REGENERATE",
        )
        return

    publisher.publish_summary_result(
        job_id=message.jobId,
        story_id=story_id,
        payload=result,
        action="REGENERATE",
    )
    logger.info(
        "[SUMMARY:REGEN] published result — jobId=%s, summaryKoLen=%d, costUsd=%s",
        message.jobId, len(result.summaryKo), result.usage.costUsd,
    )


def handle_sentence_translate_message(body: bytes, publisher: StoryResultPublisher) -> None:
    message = StorySentenceTranslationJobMessage.model_validate_json(body)
    logger.info(
        "[SENTENCE:TRANSLATE] received jobId=%s, storyId=%s, pageNumber=%s, koreanLen=%d",
        message.jobId, message.storyId, message.pageNumber, len(message.payload.koreanText),
    )

    try:
        result = translate_story_sentences(message.payload)
    except ValueError as exc:
        publisher.publish_sentence_translation_failure(
            job_id=message.jobId,
            story_id=message.storyId,
            page_number=message.pageNumber,
            error=StoryError(code="TRANSLATE_STORY_SENTENCES_ERROR", message=str(exc)),
        )
        return
    except RuntimeError as exc:
        publisher.publish_sentence_translation_failure(
            job_id=message.jobId,
            story_id=message.storyId,
            page_number=message.pageNumber,
            error=StoryError(code="TRANSLATE_STORY_SENTENCES_RUNTIME_ERROR", message=str(exc)),
        )
        return

    publisher.publish_sentence_translation_result(
        job_id=message.jobId,
        story_id=message.storyId,
        page_number=message.pageNumber,
        payload=result,
    )
    logger.info(
        "[SENTENCE:TRANSLATE] published result jobId=%s, storyId=%s, pageNumber=%s, sentenceCount=%d, costUsd=%s",
        message.jobId, message.storyId, message.pageNumber, result.sentenceCount, result.usage.costUsd,
    )


def handle_regenerate_message(body: bytes, publisher: StoryResultPublisher) -> None:
    message = StoryRegenerateJobMessage.model_validate_json(body)
    request = _merge_story_id_regenerate(message.storyId, message.payload)
    story_id = _story_id_from_regenerate(message.storyId, request)
    logger.info(
        "[STORY:REGEN] received — jobId=%s, storyId=%s",
        message.jobId, story_id,
    )

    try:
        result = regenerate_storyboard(request)
    except ValueError as exc:
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=story_id,
            error=StoryError(code="REGENERATE_STORY_ERROR", message=str(exc)),
            action="REGENERATE",
        )
        return
    except RuntimeError as exc:
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=story_id,
            error=StoryError(code="REGENERATE_STORY_RUNTIME_ERROR", message=str(exc)),
            action="REGENERATE",
        )
        return

    publisher.publish_result(
        job_id=message.jobId,
        story_id=story_id,
        payload=result,
        action="REGENERATE",
    )
    logger.info(
        "[STORY:REGEN] published result — jobId=%s, pages=%d, costUsd=%s",
        message.jobId, len(result.pages), result.usage.costUsd,
    )


def _publish_unexpected_summary_failure(
    *,
    body: bytes,
    publisher: StoryResultPublisher,
    action: str,
    exc: Exception,
) -> bool:
    try:
        payload = _extract_job_context(body)
    except Exception:
        logger.exception("Failed to extract summary job context while publishing unexpected failure")
        return False

    job_id = payload.get("jobId")
    if not isinstance(job_id, str) or not job_id.strip():
        logger.error("Cannot publish unexpected summary failure without a valid jobId")
        return False

    story_id = payload.get("storyId")
    publisher.publish_summary_failure(
        job_id=job_id,
        story_id=story_id if isinstance(story_id, int) else None,
        error=StoryError(
            code=f"{action}_STORY_SUMMARY_UNEXPECTED_ERROR",
            message=str(exc),
        ),
        action=action,
    )
    return True


def _extract_job_context(body: bytes) -> dict[str, Any]:
    parsed = json.loads(body)
    if not isinstance(parsed, dict):
        raise ValueError("Summary message body is not a JSON object")
    return {
        "jobId": parsed.get("jobId"),
        "storyId": parsed.get("storyId"),
    }


def _merge_story_id_generate(
    story_id: int | None,
    request: StoryboardGenerateRequest,
) -> StoryboardGenerateRequest:
    merged = request.model_copy(deep=True)
    if story_id is not None:
        merged.storyId = story_id
    return merged


def _merge_story_id_regenerate(
    story_id: int | None,
    request: StoryboardRegenerateRequest,
) -> StoryboardRegenerateRequest:
    merged = request.model_copy(deep=True)
    if story_id is not None:
        merged.storyId = story_id
        merged.originalRequest.storyId = story_id
    return merged


def _merge_story_id_summary(
    story_id: int | None,
    request: StoryboardSummaryGenerateRequest,
) -> StoryboardSummaryGenerateRequest:
    merged = request.model_copy(deep=True)
    if story_id is not None:
        merged.storyId = story_id
    return merged


def _merge_story_id_summary_regenerate(
    story_id: int | None,
    request: StoryboardSummaryRegenerateRequest,
) -> StoryboardSummaryRegenerateRequest:
    merged = request.model_copy(deep=True)
    if story_id is not None:
        merged.storyId = story_id
    return merged


def _story_id_from_generate(story_id: int | None, request: StoryboardGenerateRequest) -> int | None:
    return story_id if story_id is not None else request.storyId


def _story_id_from_summary(
    story_id: int | None,
    request: StoryboardSummaryGenerateRequest,
) -> int | None:
    return story_id if story_id is not None else request.storyId


def _story_id_from_summary_regenerate(
    story_id: int | None,
    request: StoryboardSummaryRegenerateRequest,
) -> int | None:
    return story_id if story_id is not None else request.storyId


def _story_id_from_regenerate(
    story_id: int | None,
    request: StoryboardRegenerateRequest,
) -> int | None:
    if story_id is not None:
        return story_id
    if request.storyId is not None:
        return request.storyId
    return request.originalRequest.storyId
