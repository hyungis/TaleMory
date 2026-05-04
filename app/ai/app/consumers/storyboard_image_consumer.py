import json
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
from app.services.storyboard_image_service import (
    ensure_storyboard_character_reference,
    generate_storyboard_image_item,
    regenerate_storyboard_image,
)
from app.worker_async import ApiJob, publisher_channel, submit_image_api_message, submit_message

logger = logging.getLogger(__name__)


def register_storyboard_image_consumers(channel: Any) -> None:
    channel.basic_consume(
        queue=settings.RABBITMQ_IMAGE_GENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_generate_batch_message(
            ch, method.delivery_tag, body
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_IMAGE_GENERATE_ITEM_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_generate_item_message(
            ch, method.delivery_tag, body
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_IMAGE_REGENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_regenerate_message(
            ch, method.delivery_tag, body
        ),
    )


def _dispatch_generate_batch_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
) -> None:
    submit_message(
        consumer_channel=channel,
        delivery_tag=delivery_tag,
        task=lambda: _process_generate_batch_message(body),
        task_name="generate storyboard image batch message",
    )


def _dispatch_generate_item_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
) -> None:
    submit_image_api_message(
        consumer_channel=channel,
        delivery_tag=delivery_tag,
        job_factory=lambda: _create_generate_item_job(body),
        task_name="generate storyboard image item message",
    )


def _dispatch_regenerate_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
) -> None:
    submit_image_api_message(
        consumer_channel=channel,
        delivery_tag=delivery_tag,
        job_factory=lambda: _create_regenerate_job(body),
        task_name="regenerate storyboard image message",
    )


def _create_generate_item_job(body: bytes) -> ApiJob:
    message = StoryboardImageGenerateItemJobMessage.model_validate_json(body)
    page_number = message.payload.item.pageNumber
    return ApiJob(
        task=lambda: generate_storyboard_image_item(
            story_id=message.storyId,
            item=message.payload.item,
            seed=message.payload.seed,
        ),
        on_success=lambda result: _publish_image_result(message, result, "GENERATE"),
        on_error=lambda exc: _publish_image_failure(
            message.jobId,
            message.storyId,
            page_number,
            exc,
            "GENERATE",
        ),
    )


def _create_regenerate_job(body: bytes) -> ApiJob:
    message = StoryboardImageRegenerateJobMessage.model_validate_json(body)
    page_number = message.payload.item.pageNumber
    return ApiJob(
        task=lambda: regenerate_storyboard_image(message.payload),
        on_success=lambda response: _publish_image_result(
            message,
            response.result,
            "REGENERATE",
            seed=response.seed,
        ),
        on_error=lambda exc: _publish_image_failure(
            message.jobId,
            message.storyId,
            page_number,
            exc,
            "REGENERATE",
        ),
    )


def _process_generate_batch_message(body: bytes) -> bool:
    with publisher_channel() as channel:
        publisher = StoryboardImageJobPublisher(channel)
        try:
            handle_generate_batch_message(body=body, publisher=publisher)
        except Exception:
            logger.exception("Unexpected error while processing generate storyboard image batch message")
            return _publish_unexpected_failure(body, publisher, action="GENERATE")
    return True


def _process_generate_item_message(body: bytes) -> bool:
    with publisher_channel() as channel:
        publisher = StoryboardImageJobPublisher(channel)
        try:
            handle_generate_item_message(body=body, publisher=publisher)
        except Exception:
            logger.exception("Unexpected error while processing generate storyboard image item message")
            return _publish_unexpected_failure(body, publisher, action="GENERATE")
    return True


def _process_regenerate_message(body: bytes) -> bool:
    with publisher_channel() as channel:
        publisher = StoryboardImageJobPublisher(channel)
        try:
            handle_regenerate_message(body=body, publisher=publisher)
        except Exception:
            logger.exception("Unexpected error while processing regenerate storyboard image message")
            return _publish_unexpected_failure(body, publisher, action="REGENERATE")
    return True


def _publish_image_result(
    message: StoryboardImageGenerateItemJobMessage | StoryboardImageRegenerateJobMessage,
    result: Any,
    action: str,
    seed: int | None = None,
) -> bool:
    if seed is None:
        seed = message.payload.seed
    with publisher_channel() as channel:
        publisher = StoryboardImageJobPublisher(channel)
        publisher.publish_result(
            job_id=message.jobId,
            story_id=message.storyId,
            seed=seed,
            result=result,
            action=action,
        )
    return True


def _publish_image_failure(
    job_id: str,
    story_id: int,
    page_number: int,
    exc: BaseException,
    action: str,
) -> bool:
    if isinstance(exc, ValueError):
        code = f"{action}_STORYBOARD_IMAGE_ERROR"
        message = str(exc)
    elif isinstance(exc, RuntimeError):
        code = f"{action}_STORYBOARD_IMAGE_RUNTIME_ERROR"
        message = str(exc)
    else:
        logger.exception("Unexpected storyboard image api error", exc_info=exc)
        code = f"{action}_STORYBOARD_IMAGE_UNEXPECTED_ERROR"
        message = "Unexpected worker error"

    with publisher_channel() as channel:
        publisher = StoryboardImageJobPublisher(channel)
        publisher.publish_failure(
            job_id=job_id,
            story_id=story_id,
            page_number=page_number,
            error=StoryboardImageError(code=code, message=message),
            action=action,
        )
    return True


def handle_generate_batch_message(body: bytes, publisher: StoryboardImageJobPublisher) -> None:
    message = StoryboardImageGenerateJobMessage.model_validate_json(body)
    # BE 가 보낸 사용자 선택 character source 사진(`characterSourceImageS3Keys`)을 helper 로 전달.
    # 누락 시 helper 가 fallback 으로 페이지별 referenceImage 들을 pool 해서 사용 (= 사용자 선택 무시).
    # HTTP REST 진입점 (services.storyboard_image_service.generate_storyboard_images) 과 동일한 시그니처.
    items = ensure_storyboard_character_reference(
        message.payload.storyId,
        message.payload.seed,
        message.payload.items,
        message.payload.characterSourceImageUrls,
        message.payload.characterSourceImageS3Keys,
    )

    for item in items:
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


def _publish_unexpected_failure(
    body: bytes,
    publisher: StoryboardImageJobPublisher,
    action: str,
) -> bool:
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
            error=StoryboardImageError(
                code=f"{action}_STORYBOARD_IMAGE_UNEXPECTED_ERROR",
                message="Unexpected worker error",
            ),
            action=action,
        )
        return True
    except Exception:
        logger.exception("Failed to publish unexpected storyboard image failure event")
        return False
