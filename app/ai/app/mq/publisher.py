import json
from typing import Literal
from typing import Any

import pika

from app.core.config import settings
from app.schemas.mq_storyboard import StoryError, StoryFailureEnvelope, StorySuccessEnvelope
from app.schemas.storyboard import StoryboardGenerateResponse


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
