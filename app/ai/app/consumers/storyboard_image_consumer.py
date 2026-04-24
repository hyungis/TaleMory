import logging
from typing import Any

from app.core.config import settings
from app.mq.publisher import StoryboardImageJobPublisher
from app.schemas.mq_storyboard_image import (
    StoryboardImageError,
    StoryboardImageGenerateItemJobMessage,
    StoryboardImageGenerateItemJobPayload,
    StoryboardImageGenerateJobMessage,
    StoryboardImageRegenerateJobMessage,
)
from app.services.storyboard_image_service import generate_storyboard_image_item, regenerate_storyboard_image

logger = logging.getLogger(__name__)


def register_storyboard_image_consumers(channel: Any) -> None:
    publisher = StoryboardImageJobPublisher(channel)

    channel.basic_consume(
        queue=settings.RABBITMQ_IMAGE_GENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_generate_batch_message(
            ch, method.delivery_tag, body, publisher
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_IMAGE_GENERATE_ITEM_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_generate_item_message(
            ch, method.delivery_tag, body, publisher
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_IMAGE_REGENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_regenerate_message(
            ch, method.delivery_tag, body, publisher
        ),
    )


def _dispatch_generate_batch_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
    publisher: StoryboardImageJobPublisher,
) -> None:
    try:
        handle_generate_batch_message(body=body, publisher=publisher)
    except Exception:
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        logger.exception("Unexpected error while processing generate storyboard image batch message")
    else:
        channel.basic_ack(delivery_tag=delivery_tag)


def _dispatch_generate_item_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
    publisher: StoryboardImageJobPublisher,
) -> None:
    try:
        handle_generate_item_message(body=body, publisher=publisher)
    except Exception:
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        logger.exception("Unexpected error while processing generate storyboard image item message")
    else:
        channel.basic_ack(delivery_tag=delivery_tag)


def _dispatch_regenerate_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
    publisher: StoryboardImageJobPublisher,
) -> None:
    try:
        handle_regenerate_message(body=body, publisher=publisher)
    except Exception:
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        logger.exception("Unexpected error while processing regenerate storyboard image message")
    else:
        channel.basic_ack(delivery_tag=delivery_tag)


def handle_generate_batch_message(body: bytes, publisher: StoryboardImageJobPublisher) -> None:
    message = StoryboardImageGenerateJobMessage.model_validate_json(body)

    for item in message.payload.items:
        publisher.publish_generate_item_job(
            StoryboardImageGenerateItemJobMessage(
                jobId=message.jobId,
                storyId=message.storyId,
                payload=StoryboardImageGenerateItemJobPayload(
                    seed=message.payload.seed,
                    item=item,
                ),
            )
        )


def handle_generate_item_message(body: bytes, publisher: StoryboardImageJobPublisher) -> None:
    message = StoryboardImageGenerateItemJobMessage.model_validate_json(body)
    page_number = message.payload.item.pageNumber

    try:
        result = generate_storyboard_image_item(
            story_id=message.storyId,
            item=message.payload.item,
            seed=message.payload.seed,
        )
    except ValueError as exc:
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=message.storyId,
            page_number=page_number,
            error=StoryboardImageError(code="GENERATE_STORYBOARD_IMAGE_ERROR", message=str(exc)),
            action="GENERATE",
        )
        return
    except RuntimeError as exc:
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=message.storyId,
            page_number=page_number,
            error=StoryboardImageError(code="GENERATE_STORYBOARD_IMAGE_RUNTIME_ERROR", message=str(exc)),
            action="GENERATE",
        )
        return

    publisher.publish_result(
        job_id=message.jobId,
        story_id=message.storyId,
        seed=message.payload.seed,
        result=result,
        action="GENERATE",
    )


def handle_regenerate_message(body: bytes, publisher: StoryboardImageJobPublisher) -> None:
    message = StoryboardImageRegenerateJobMessage.model_validate_json(body)
    page_number = message.payload.item.pageNumber

    try:
        response = regenerate_storyboard_image(message.payload)
    except ValueError as exc:
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=message.storyId,
            page_number=page_number,
            error=StoryboardImageError(code="REGENERATE_STORYBOARD_IMAGE_ERROR", message=str(exc)),
            action="REGENERATE",
        )
        return
    except RuntimeError as exc:
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=message.storyId,
            page_number=page_number,
            error=StoryboardImageError(code="REGENERATE_STORYBOARD_IMAGE_RUNTIME_ERROR", message=str(exc)),
            action="REGENERATE",
        )
        return

    publisher.publish_result(
        job_id=message.jobId,
        story_id=message.storyId,
        seed=response.seed,
        result=response.result,
        action="REGENERATE",
    )
