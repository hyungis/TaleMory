from typing import Any

try:
    import pika
except ModuleNotFoundError:  # pragma: no cover - handled at runtime
    pika = None

from app.core.config import settings
from app.mq.client import create_channel, create_connection, declare_storyboard_topology
from app.mq.publisher import StoryResultPublisher
from app.schemas.mq_storyboard import StoryError, StoryGenerateJobMessage, StoryRegenerateJobMessage
from app.schemas.storyboard import StoryboardGenerateRequest, StoryboardRegenerateRequest
from app.services.storyboard_service import generate_storyboard, regenerate_storyboard


def consume_storyboard_jobs() -> None:
    connection = create_connection()
    channel = create_channel(connection)
    declare_storyboard_topology(channel)
    publisher = StoryResultPublisher(channel)

    channel.basic_consume(
        queue=settings.RABBITMQ_GENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_generate_message(
            ch, method.delivery_tag, body, publisher
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_REGENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_regenerate_message(
            ch, method.delivery_tag, body, publisher
        ),
    )
    try:
        channel.start_consuming()
    finally:
        if connection.is_open:
            connection.close()


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
        raise
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
        raise
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


def _story_id_from_generate(story_id: int | None, request: StoryboardGenerateRequest) -> int | None:
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
