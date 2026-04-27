import json
from typing import Literal
from typing import Any

import pika

from app.core.config import settings
from app.schemas.mq_storyboard_image import (
    StoryboardImageError,
    StoryboardImageFailureEnvelope,
    StoryboardImageGenerateItemJobMessage,
    StoryboardImageSuccessEnvelope,
    StoryboardImageSuccessPayload,
)
from app.schemas.mq_storyboard import StoryError, StoryFailureEnvelope, StorySuccessEnvelope
from app.schemas.mq_storyboard_summary import StorySummaryFailureEnvelope, StorySummarySuccessEnvelope
from app.schemas.storyboard import StoryboardGenerateResponse
from app.schemas.storyboard_summary import StoryboardSummaryGenerateResponse
from app.schemas.storyboard_image import StoryboardImageGenerateResult


StoryAction = Literal["GENERATE", "REGENERATE"]


class StoryResultPublisher:
    def __init__(self, channel: Any):
        self._channel = channel

    def publish_result(
        self,
        job_id: str,
        story_id: int | None,
        payload: StoryboardGenerateResponse,
        action: StoryAction,
    ) -> None:
        envelope = StorySuccessEnvelope(
            jobId=job_id,
            type=_completed_type_for_action(action),
            storyId=story_id,
            payload=payload,
        )
        self._publish(
            routing_key=_completed_routing_key_for_action(action),
            message=envelope.model_dump(mode="json"),
        )

    def publish_failure(
        self,
        job_id: str,
        story_id: int | None,
        error: StoryError,
        action: StoryAction,
    ) -> None:
        envelope = StoryFailureEnvelope(
            jobId=job_id,
            type=_failed_type_for_action(action),
            storyId=story_id,
            error=error,
        )
        self._publish(
            routing_key=_failed_routing_key_for_action(action),
            message=envelope.model_dump(mode="json"),
        )

    def publish_summary_result(
        self,
        job_id: str,
        story_id: int | None,
        payload: StoryboardSummaryGenerateResponse,
        action: StoryAction = "GENERATE",
    ) -> None:
        envelope = StorySummarySuccessEnvelope(
            jobId=job_id,
            type=_summary_completed_type_for_action(action),
            storyId=story_id,
            payload=payload,
        )
        self._publish(
            routing_key=_summary_completed_routing_key_for_action(action),
            message=envelope.model_dump(mode="json"),
        )

    def publish_summary_failure(
        self,
        job_id: str,
        story_id: int | None,
        error: StoryError,
        action: StoryAction = "GENERATE",
    ) -> None:
        envelope = StorySummaryFailureEnvelope(
            jobId=job_id,
            type=_summary_failed_type_for_action(action),
            storyId=story_id,
            error=error,
        )
        self._publish(
            routing_key=_summary_failed_routing_key_for_action(action),
            message=envelope.model_dump(mode="json"),
        )

    def _publish(self, routing_key: str, message: dict) -> None:
        self._channel.basic_publish(
            exchange=settings.RABBITMQ_RESULT_EXCHANGE,
            routing_key=routing_key,
            body=json.dumps(message, ensure_ascii=False).encode("utf-8"),
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2,
            ),
        )


def _completed_type_for_action(action: StoryAction) -> str:
    return "GENERATE_STORY_COMPLETED" if action == "GENERATE" else "REGENERATE_STORY_COMPLETED"


def _failed_type_for_action(action: StoryAction) -> str:
    return "GENERATE_STORY_FAILED" if action == "GENERATE" else "REGENERATE_STORY_FAILED"


def _completed_routing_key_for_action(action: StoryAction) -> str:
    return (
        settings.RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY
        if action == "GENERATE"
        else settings.RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY
    )


def _failed_routing_key_for_action(action: StoryAction) -> str:
    return (
        settings.RABBITMQ_GENERATE_FAILED_ROUTING_KEY
        if action == "GENERATE"
        else settings.RABBITMQ_REGENERATE_FAILED_ROUTING_KEY
    )


def _summary_completed_type_for_action(action: StoryAction) -> str:
    return "GENERATE_STORY_SUMMARY_COMPLETED" if action == "GENERATE" else "REGENERATE_STORY_SUMMARY_COMPLETED"


def _summary_failed_type_for_action(action: StoryAction) -> str:
    return "GENERATE_STORY_SUMMARY_FAILED" if action == "GENERATE" else "REGENERATE_STORY_SUMMARY_FAILED"


def _summary_completed_routing_key_for_action(action: StoryAction) -> str:
    return (
        settings.RABBITMQ_SUMMARY_GENERATE_COMPLETED_ROUTING_KEY
        if action == "GENERATE"
        else settings.RABBITMQ_SUMMARY_REGENERATE_COMPLETED_ROUTING_KEY
    )


def _summary_failed_routing_key_for_action(action: StoryAction) -> str:
    return (
        settings.RABBITMQ_SUMMARY_GENERATE_FAILED_ROUTING_KEY
        if action == "GENERATE"
        else settings.RABBITMQ_SUMMARY_REGENERATE_FAILED_ROUTING_KEY
    )


StoryboardImageAction = Literal["GENERATE", "REGENERATE"]


class StoryboardImageJobPublisher:
    def __init__(self, channel: Any):
        self._channel = channel

    def publish_generate_item_job(self, message: StoryboardImageGenerateItemJobMessage) -> None:
        self._publish(
            exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
            routing_key=settings.RABBITMQ_IMAGE_GENERATE_ITEM_ROUTING_KEY,
            message=message.model_dump(mode="json"),
        )

    def publish_result(
        self,
        job_id: str,
        story_id: int,
        seed: int,
        result: StoryboardImageGenerateResult,
        action: StoryboardImageAction,
    ) -> None:
        envelope = StoryboardImageSuccessEnvelope(
            jobId=job_id,
            type=_image_completed_type_for_action(action),
            storyId=story_id,
            pageNumber=result.pageNumber,
            payload=StoryboardImageSuccessPayload(seed=seed, result=result),
        )
        self._publish(
            exchange=settings.RABBITMQ_RESULT_EXCHANGE,
            routing_key=_image_completed_routing_key_for_action(action),
            message=envelope.model_dump(mode="json"),
        )

    def publish_failure(
        self,
        job_id: str,
        story_id: int,
        error: StoryboardImageError,
        action: StoryboardImageAction,
        page_number: int | None = None,
    ) -> None:
        envelope = StoryboardImageFailureEnvelope(
            jobId=job_id,
            type=_image_failed_type_for_action(action),
            storyId=story_id,
            pageNumber=page_number,
            error=error,
        )
        self._publish(
            exchange=settings.RABBITMQ_RESULT_EXCHANGE,
            routing_key=_image_failed_routing_key_for_action(action),
            message=envelope.model_dump(mode="json"),
        )

    def _publish(self, exchange: str, routing_key: str, message: dict) -> None:
        self._channel.basic_publish(
            exchange=exchange,
            routing_key=routing_key,
            body=json.dumps(message, ensure_ascii=False).encode("utf-8"),
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2,
            ),
        )


def _image_completed_type_for_action(action: StoryboardImageAction) -> str:
    return (
        "GENERATE_STORYBOARD_IMAGE_COMPLETED"
        if action == "GENERATE"
        else "REGENERATE_STORYBOARD_IMAGE_COMPLETED"
    )


def _image_failed_type_for_action(action: StoryboardImageAction) -> str:
    return (
        "GENERATE_STORYBOARD_IMAGE_FAILED"
        if action == "GENERATE"
        else "REGENERATE_STORYBOARD_IMAGE_FAILED"
    )


def _image_completed_routing_key_for_action(action: StoryboardImageAction) -> str:
    return (
        settings.RABBITMQ_IMAGE_GENERATE_COMPLETED_ROUTING_KEY
        if action == "GENERATE"
        else settings.RABBITMQ_IMAGE_REGENERATE_COMPLETED_ROUTING_KEY
    )


def _image_failed_routing_key_for_action(action: StoryboardImageAction) -> str:
    return (
        settings.RABBITMQ_IMAGE_GENERATE_FAILED_ROUTING_KEY
        if action == "GENERATE"
        else settings.RABBITMQ_IMAGE_REGENERATE_FAILED_ROUTING_KEY
    )
