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
from app.worker_async import ApiJob, publisher_channel, submit_image_api_message, submit_message

logger = logging.getLogger(__name__)


def register_final_illustration_consumers(channel: Any) -> None:
    channel.basic_consume(
        queue=settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_generate_batch_message(
            ch, method.delivery_tag, body
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_generate_item_message(
            ch, method.delivery_tag, body
        ),
    )
    channel.basic_consume(
        queue=settings.RABBITMQ_FINAL_ILLUSTRATION_REVISE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_revise_message(
            ch, method.delivery_tag, body
        ),
    )


def _dispatch_generate_batch_message(channel: Any, delivery_tag: int, body: bytes) -> None:
    submit_message(
        consumer_channel=channel,
        delivery_tag=delivery_tag,
        task=lambda: _process_generate_batch_message(body),
        task_name="generate final illustration batch message",
    )


def _dispatch_generate_item_message(channel: Any, delivery_tag: int, body: bytes) -> None:
    submit_image_api_message(
        consumer_channel=channel,
        delivery_tag=delivery_tag,
        job_factory=lambda: _create_generate_item_job(body),
        task_name="generate final illustration item message",
    )


def _dispatch_revise_message(channel: Any, delivery_tag: int, body: bytes) -> None:
    submit_image_api_message(
        consumer_channel=channel,
        delivery_tag=delivery_tag,
        job_factory=lambda: _create_revise_job(body),
        task_name="revise final illustration message",
    )


def _create_generate_item_job(body: bytes) -> ApiJob:
    message = FinalIllustrationGenerateItemJobMessage.model_validate_json(body)
    page_number = message.payload.item.pageNumber
    return ApiJob(
        task=lambda: _generate_final_illustration_item_with_log(message),
        on_success=lambda result: _publish_final_illustration_result(message, result, "GENERATE"),
        on_error=lambda exc: _publish_final_illustration_failure(
            message.jobId,
            message.storyId,
            page_number,
            exc,
            "GENERATE",
        ),
    )


def _create_revise_job(body: bytes) -> ApiJob:
    message = FinalIllustrationReviseJobMessage.model_validate_json(body)
    page_number = message.payload.item.pageNumber
    return ApiJob(
        task=lambda: _revise_final_illustration_with_log(message),
        on_success=lambda response: _publish_final_illustration_result(
            message,
            response.result,
            "REVISE",
            seed=response.seed,
        ),
        on_error=lambda exc: _publish_final_illustration_failure(
            message.jobId,
            message.storyId,
            page_number,
            exc,
            "REVISE",
        ),
    )


def _generate_final_illustration_item_with_log(message: FinalIllustrationGenerateItemJobMessage) -> Any:
    page_number = message.payload.item.pageNumber
    logger.info(
        "[FINAL_ILLUSTRATION:GEN] start jobId=%s, storyId=%s, pageNumber=%s, seed=%s",
        message.jobId, message.storyId, page_number, message.payload.seed,
    )
    return generate_final_illustration_item(
        story_id=message.storyId,
        item=message.payload.item,
        seed=message.payload.seed,
        render_options=message.payload.renderOptions,
    )


def _revise_final_illustration_with_log(message: FinalIllustrationReviseJobMessage) -> Any:
    page_number = message.payload.item.pageNumber
    logger.info(
        "[FINAL_ILLUSTRATION:REVISE] start jobId=%s, storyId=%s, pageNumber=%s, seed=%s",
        message.jobId, message.storyId, page_number, message.payload.seed,
    )
    return revise_final_illustration(message.payload)


def _process_generate_batch_message(body: bytes) -> bool:
    with publisher_channel() as channel:
        publisher = FinalIllustrationJobPublisher(channel)
        try:
            handle_generate_batch_message(body=body, publisher=publisher)
        except Exception:
            logger.exception("Unexpected error while processing generate final illustration batch message")
            return _publish_unexpected_failure(body, publisher, action="GENERATE")
    return True


def _process_generate_item_message(body: bytes) -> bool:
    with publisher_channel() as channel:
        publisher = FinalIllustrationJobPublisher(channel)
        try:
            handle_generate_item_message(body=body, publisher=publisher)
        except Exception:
            logger.exception("Unexpected error while processing generate final illustration item message")
            return _publish_unexpected_failure(body, publisher, action="GENERATE")
    return True


def _process_revise_message(body: bytes) -> bool:
    with publisher_channel() as channel:
        publisher = FinalIllustrationJobPublisher(channel)
        try:
            handle_revise_message(body=body, publisher=publisher)
        except Exception:
            logger.exception("Unexpected error while processing revise final illustration message")
            return _publish_unexpected_failure(body, publisher, action="REVISE")
    return True


def _publish_final_illustration_result(
    message: FinalIllustrationGenerateItemJobMessage | FinalIllustrationReviseJobMessage,
    result: Any,
    action: str,
    seed: int | None = None,
) -> bool:
    if seed is None:
        seed = message.payload.seed
    with publisher_channel() as channel:
        publisher = FinalIllustrationJobPublisher(channel)
        publisher.publish_result(
            job_id=message.jobId,
            story_id=message.storyId,
            seed=seed,
            result=result,
            action=action,
        )
    logger.info(
        "[FINAL_ILLUSTRATION:%s] done jobId=%s, storyId=%s, pageNumber=%s, seed=%s",
        "GEN" if action == "GENERATE" else "REVISE",
        message.jobId,
        message.storyId,
        message.payload.item.pageNumber,
        seed,
    )
    return True


def _publish_final_illustration_failure(
    job_id: str,
    story_id: int,
    page_number: int,
    exc: BaseException,
    action: str,
) -> bool:
    if isinstance(exc, ValueError):
        code = f"{action}_FINAL_ILLUSTRATION_ERROR"
        message = str(exc)
    elif isinstance(exc, RuntimeError):
        code = f"{action}_FINAL_ILLUSTRATION_RUNTIME_ERROR"
        message = str(exc)
    else:
        logger.exception("Unexpected final illustration api error", exc_info=exc)
        code = f"{action}_FINAL_ILLUSTRATION_UNEXPECTED_ERROR"
        message = "Unexpected worker error"

    with publisher_channel() as channel:
        publisher = FinalIllustrationJobPublisher(channel)
        publisher.publish_failure(
            job_id=job_id,
            story_id=story_id,
            page_number=page_number,
            error=FinalIllustrationError(code=code, message=message),
            action=action,
        )
    logger.warning(
        "[FINAL_ILLUSTRATION:%s] failed jobId=%s, storyId=%s, pageNumber=%s, code=%s, message=%s",
        "GEN" if action == "GENERATE" else "REVISE",
        job_id,
        story_id,
        page_number,
        code,
        message,
    )
    return True


def handle_generate_batch_message(body: bytes, publisher: FinalIllustrationJobPublisher) -> None:
    message = FinalIllustrationGenerateJobMessage.model_validate_json(body)
    logger.info(
        "[FINAL_ILLUSTRATION:BATCH] start jobId=%s, storyId=%s, itemCount=%d, seed=%s",
        message.jobId, message.storyId, len(message.payload.items), message.payload.seed,
    )

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
    logger.info(
        "[FINAL_ILLUSTRATION:BATCH] done jobId=%s, storyId=%s, publishedItems=%d",
        message.jobId, message.storyId, len(message.payload.items),
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
