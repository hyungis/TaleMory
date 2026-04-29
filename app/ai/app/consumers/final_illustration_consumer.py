import json
import logging
from typing import Any

from app.core.config import settings
from app.mq.publisher import FinalIllustrationJobPublisher
from app.schemas.mq_final_illustration import (
    FinalIllustrationError,
    FinalIllustrationGenerateItemJobMessage,
    FinalIllustrationGenerateItemJobPayload,
    FinalIllustrationGenerateJobMessage,
    FinalIllustrationReviseJobMessage,
)
from app.services.final_illustration_service import (
    generate_final_illustration_item,
    revise_final_illustration,
)

logger = logging.getLogger(__name__)


def register_final_illustration_consumers(channel: Any) -> None:
    publisher = FinalIllustrationJobPublisher(channel)

    channel.basic_consume(
        queue=settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_generate_batch_message(
            ch, method.delivery_tag, body, publisher
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_generate_item_message(
            ch, method.delivery_tag, body, publisher
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_FINAL_ILLUSTRATION_REVISE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_revise_message(
            ch, method.delivery_tag, body, publisher
        ),
    )


def _dispatch_generate_batch_message(channel: Any, delivery_tag: int, body: bytes, publisher: FinalIllustrationJobPublisher) -> None:
    try:
        handle_generate_batch_message(body=body, publisher=publisher)
    except Exception:
        logger.exception("Unexpected error while processing generate final illustration batch message")
        if _publish_unexpected_failure(body, publisher, action="GENERATE"):
            channel.basic_ack(delivery_tag=delivery_tag)
            return
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
    else:
        channel.basic_ack(delivery_tag=delivery_tag)


def _dispatch_generate_item_message(channel: Any, delivery_tag: int, body: bytes, publisher: FinalIllustrationJobPublisher) -> None:
    try:
        handle_generate_item_message(body=body, publisher=publisher)
    except Exception:
        logger.exception("Unexpected error while processing generate final illustration item message")
        if _publish_unexpected_failure(body, publisher, action="GENERATE"):
            channel.basic_ack(delivery_tag=delivery_tag)
            return
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
    else:
        channel.basic_ack(delivery_tag=delivery_tag)


def _dispatch_revise_message(channel: Any, delivery_tag: int, body: bytes, publisher: FinalIllustrationJobPublisher) -> None:
    try:
        handle_revise_message(body=body, publisher=publisher)
    except Exception:
        logger.exception("Unexpected error while processing revise final illustration message")
        if _publish_unexpected_failure(body, publisher, action="REVISE"):
            channel.basic_ack(delivery_tag=delivery_tag)
            return
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
    else:
        channel.basic_ack(delivery_tag=delivery_tag)


def handle_generate_batch_message(body: bytes, publisher: FinalIllustrationJobPublisher) -> None:
    message = FinalIllustrationGenerateJobMessage.model_validate_json(body)

    for item in message.payload.items:
        publisher.publish_generate_item_job(
            FinalIllustrationGenerateItemJobMessage(
                jobId=message.jobId,
                storyId=message.storyId,
                payload=FinalIllustrationGenerateItemJobPayload(
                    seed=message.payload.seed,
                    renderOptions=message.payload.renderOptions,
                    item=item,
                ),
            )
        )


def handle_generate_item_message(body: bytes, publisher: FinalIllustrationJobPublisher) -> None:
    message = FinalIllustrationGenerateItemJobMessage.model_validate_json(body)
    page_number = message.payload.item.pageNumber

    try:
        result = generate_final_illustration_item(
            story_id=message.storyId,
            item=message.payload.item,
            seed=message.payload.seed,
            render_options=message.payload.renderOptions,
        )
    except ValueError as exc:
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=message.storyId,
            page_number=page_number,
            error=FinalIllustrationError(code="GENERATE_FINAL_ILLUSTRATION_ERROR", message=str(exc)),
            action="GENERATE",
        )
        return
    except RuntimeError as exc:
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=message.storyId,
            page_number=page_number,
            error=FinalIllustrationError(code="GENERATE_FINAL_ILLUSTRATION_RUNTIME_ERROR", message=str(exc)),
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


def handle_revise_message(body: bytes, publisher: FinalIllustrationJobPublisher) -> None:
    message = FinalIllustrationReviseJobMessage.model_validate_json(body)
    page_number = message.payload.item.pageNumber

    try:
        response = revise_final_illustration(message.payload)
    except ValueError as exc:
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=message.storyId,
            page_number=page_number,
            error=FinalIllustrationError(code="REVISE_FINAL_ILLUSTRATION_ERROR", message=str(exc)),
            action="REVISE",
        )
        return
    except RuntimeError as exc:
        publisher.publish_failure(
            job_id=message.jobId,
            story_id=message.storyId,
            page_number=page_number,
            error=FinalIllustrationError(code="REVISE_FINAL_ILLUSTRATION_RUNTIME_ERROR", message=str(exc)),
            action="REVISE",
        )
        return

    publisher.publish_result(
        job_id=message.jobId,
        story_id=message.storyId,
        seed=response.seed,
        result=response.result,
        action="REVISE",
    )


def _publish_unexpected_failure(body: bytes, publisher: FinalIllustrationJobPublisher, action: str) -> bool:
    try:
        payload = json.loads(body.decode("utf-8"))
        job_id = payload["jobId"]
        story_id = payload["storyId"]
        page_number = payload.get("pageNumber")
        if page_number is None:
            page_number = payload.get("payload", {}).get("item", {}).get("pageNumber")
        publisher.publish_failure(
            job_id=job_id,
            story_id=story_id,
            page_number=page_number,
            error=FinalIllustrationError(
                code=f"{action}_FINAL_ILLUSTRATION_UNEXPECTED_ERROR",
                message="Unexpected worker error",
            ),
            action=action,
        )
        return True
    except Exception:
        logger.exception("Failed to publish unexpected final illustration failure event")
        return False
