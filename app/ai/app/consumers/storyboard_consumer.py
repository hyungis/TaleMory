import json
import logging
from typing import Any

from app.core.config import settings
from app.mq.client import create_channel, create_connection, declare_storyboard_topology
from app.mq.publisher import StoryResultPublisher
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

logger = logging.getLogger(__name__)


def consume_storyboard_jobs() -> None:
    connection = create_connection()
    channel = create_channel(connection)
    declare_storyboard_topology(channel)
    register_storyboard_consumers(channel)
    try:
        channel.start_consuming()
    finally:
        if connection.is_open:
            connection.close()


def register_storyboard_consumers(channel: Any) -> None:
    publisher = StoryResultPublisher(channel)

    channel.basic_consume(
        queue=settings.RABBITMQ_GENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_generate_message(
            ch, method.delivery_tag, body, publisher
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_SUMMARY_GENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_summary_generate_message(
            ch, method.delivery_tag, body, publisher
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_SUMMARY_REGENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_summary_regenerate_message(
            ch, method.delivery_tag, body, publisher
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_REGENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_regenerate_message(
            ch, method.delivery_tag, body, publisher
        ),
    )


def _dispatch_generate_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
    publisher: StoryResultPublisher,
) -> None:
    try:
        handle_generate_message(body=body, publisher=publisher)
    except Exception:
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        logger.exception("Unexpected error while processing generate storyboard message")
    else:
        channel.basic_ack(delivery_tag=delivery_tag)


def _dispatch_summary_generate_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
    publisher: StoryResultPublisher,
) -> None:
    try:
        handle_summary_generate_message(body=body, publisher=publisher)
    except Exception as exc:
        logger.exception("Unexpected error while processing generate storyboard summary message")
        if _publish_unexpected_summary_failure(body=body, publisher=publisher, action="GENERATE", exc=exc):
            channel.basic_ack(delivery_tag=delivery_tag)
            return
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
    else:
        channel.basic_ack(delivery_tag=delivery_tag)


def _dispatch_regenerate_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
    publisher: StoryResultPublisher,
) -> None:
    try:
        handle_regenerate_message(body=body, publisher=publisher)
    except Exception:
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        logger.exception("Unexpected error while processing regenerate storyboard message")
    else:
        channel.basic_ack(delivery_tag=delivery_tag)


def _dispatch_summary_regenerate_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
    publisher: StoryResultPublisher,
) -> None:
    try:
        handle_summary_regenerate_message(body=body, publisher=publisher)
    except Exception as exc:
        logger.exception("Unexpected error while processing regenerate storyboard summary message")
        if _publish_unexpected_summary_failure(body=body, publisher=publisher, action="REGENERATE", exc=exc):
            channel.basic_ack(delivery_tag=delivery_tag)
            return
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
    else:
        channel.basic_ack(delivery_tag=delivery_tag)


def handle_generate_message(body: bytes, publisher: StoryResultPublisher) -> None:
    message = StoryGenerateJobMessage.model_validate_json(body)
    request = _merge_story_id_generate(message.storyId, message.payload)
    story_id = _story_id_from_generate(message.storyId, request)

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


def handle_summary_generate_message(body: bytes, publisher: StoryResultPublisher) -> None:
    message = StorySummaryGenerateJobMessage.model_validate_json(body)
    request = _merge_story_id_summary(message.storyId, message.payload)
    story_id = _story_id_from_summary(message.storyId, request)

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


def handle_summary_regenerate_message(body: bytes, publisher: StoryResultPublisher) -> None:
    message = StorySummaryRegenerateJobMessage.model_validate_json(body)
    request = _merge_story_id_summary_regenerate(message.storyId, message.payload)
    story_id = _story_id_from_summary_regenerate(message.storyId, request)

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


def handle_regenerate_message(body: bytes, publisher: StoryResultPublisher) -> None:
    message = StoryRegenerateJobMessage.model_validate_json(body)
    request = _merge_story_id_regenerate(message.storyId, message.payload)
    story_id = _story_id_from_regenerate(message.storyId, request)

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
