import json
import logging
from typing import Literal
from typing import Any

import pika

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.schemas.final_illustration import FinalIllustrationGenerateResult
from app.schemas.mq_final_illustration import (
    FinalIllustrationError,
    FinalIllustrationFailureEnvelope,
    FinalIllustrationGenerateItemJobMessage,
    FinalIllustrationSuccessEnvelope,
    FinalIllustrationSuccessPayload,
)
from app.schemas.mq_storyboard_image import (
    StoryboardImageError,
    StoryboardImageFailureEnvelope,
    StoryboardImageGenerateItemJobMessage,
    StoryboardImageSuccessEnvelope,
    StoryboardImageSuccessPayload,
)
from app.schemas.mq_storyboard import StoryError, StoryFailureEnvelope, StorySuccessEnvelope
from app.schemas.mq_story_sentence_translation import (
    StorySentenceTranslationFailureEnvelope,
    StorySentenceTranslationSuccessEnvelope,
)
from app.schemas.mq_storyboard_summary import (
    StorySummaryFailureEnvelope,
    StorySummaryMode,
    StorySummarySuccessEnvelope,
)
from app.schemas.mq_tts import StoryTtsResultPayload, TtsError, TtsFailureEnvelope, TtsSuccessEnvelope
from app.schemas.mq_tts_preview import (
    PreviewTtsError,
    PreviewTtsFailureEnvelope,
    PreviewTtsResultPayload,
    PreviewTtsSuccessEnvelope,
)
from app.schemas.storyboard import StoryboardGenerateResponse
from app.schemas.storyboard import StorySentenceTranslationResponse
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
        story_mode: StorySummaryMode = "VIEWER",
    ) -> None:
        envelope = StorySummarySuccessEnvelope(
            jobId=job_id,
            type=_summary_completed_type_for_action(action),
            storyMode=story_mode,
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
        story_mode: StorySummaryMode = "VIEWER",
    ) -> None:
        envelope = StorySummaryFailureEnvelope(
            jobId=job_id,
            type=_summary_failed_type_for_action(action),
            storyMode=story_mode,
            storyId=story_id,
            error=error,
        )
        self._publish(
            routing_key=_summary_failed_routing_key_for_action(action),
            message=envelope.model_dump(mode="json"),
        )

    def publish_sentence_translation_result(
        self,
        job_id: str,
        story_id: int | None,
        page_number: int | None,
        payload: StorySentenceTranslationResponse,
    ) -> None:
        envelope = StorySentenceTranslationSuccessEnvelope(
            jobId=job_id,
            storyId=story_id,
            pageNumber=page_number,
            payload=payload,
        )
        self._publish(
            routing_key=settings.RABBITMQ_SENTENCE_TRANSLATE_COMPLETED_ROUTING_KEY,
            message=envelope.model_dump(mode="json"),
        )

    def publish_sentence_translation_failure(
        self,
        job_id: str,
        story_id: int | None,
        page_number: int | None,
        error: StoryError,
    ) -> None:
        envelope = StorySentenceTranslationFailureEnvelope(
            jobId=job_id,
            storyId=story_id,
            pageNumber=page_number,
            error=error,
        )
        self._publish(
            routing_key=settings.RABBITMQ_SENTENCE_TRANSLATE_FAILED_ROUTING_KEY,
            message=envelope.model_dump(mode="json"),
        )

    def _publish(self, routing_key: str, message: dict) -> None:
        logger.info(
            "[STORY/SUMMARY:PUB] exchange=%s, routingKey=%s, type=%s, jobId=%s, storyId=%s",
            settings.RABBITMQ_RESULT_EXCHANGE,
            routing_key,
            message.get("type"),
            message.get("jobId"),
            message.get("storyId"),
        )
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
class TtsResultPublisher:
    def __init__(self, channel: Any):
        self._channel = channel

    def publish_result(
        self,
        job_id: str,
        story_id: int | None,
        payload: StoryTtsResultPayload,
    ) -> None:
        envelope = TtsSuccessEnvelope(
            jobId=job_id,
            type="GENERATE_TTS_COMPLETED",
            storyId=story_id,
            payload=payload,
        )
        self._publish(
            routing_key=settings.RABBITMQ_TTS_GENERATE_COMPLETED_ROUTING_KEY,
            message=envelope.model_dump(mode="json"),
        )

    def publish_failure(
        self,
        job_id: str,
        story_id: int | None,
        error: TtsError,
    ) -> None:
        envelope = TtsFailureEnvelope(
            jobId=job_id,
            type="GENERATE_TTS_FAILED",
            storyId=story_id,
            error=error,
        )
        self._publish(
            routing_key=settings.RABBITMQ_TTS_GENERATE_FAILED_ROUTING_KEY,
            message=envelope.model_dump(mode="json"),
        )

    def publish_preview_result(
        self,
        job_id: str,
        payload: PreviewTtsResultPayload,
    ) -> None:
        envelope = PreviewTtsSuccessEnvelope(
            jobId=job_id,
            payload=payload,
        )
        self._publish(
            routing_key="ai.result.tts.preview.completed",
            message=envelope.model_dump(mode="json"),
        )

    def publish_preview_failure(
        self,
        job_id: str,
        error: PreviewTtsError,
    ) -> None:
        envelope = PreviewTtsFailureEnvelope(
            jobId=job_id,
            error=error,
        )
        self._publish(
            routing_key="ai.result.tts.preview.failed",
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


FinalIllustrationAction = Literal["GENERATE", "REVISE"]


class FinalIllustrationJobPublisher:
    def __init__(self, channel: Any):
        self._channel = channel

    def publish_generate_item_job(self, message: FinalIllustrationGenerateItemJobMessage) -> None:
        self._publish(
            exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
            routing_key=settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_ROUTING_KEY,
            message=message.model_dump(mode="json"),
        )

    def publish_result(
        self,
        job_id: str,
        story_id: int,
        seed: int,
        result: FinalIllustrationGenerateResult,
        action: FinalIllustrationAction,
    ) -> None:
        envelope = FinalIllustrationSuccessEnvelope(
            jobId=job_id,
            type=_final_illustration_completed_type_for_action(action),
            storyId=story_id,
            pageNumber=result.pageNumber,
            payload=FinalIllustrationSuccessPayload(seed=seed, result=result),
        )
        self._publish(
            exchange=settings.RABBITMQ_RESULT_EXCHANGE,
            routing_key=_final_illustration_completed_routing_key_for_action(action),
            message=envelope.model_dump(mode="json"),
        )

    def publish_failure(
        self,
        job_id: str,
        story_id: int,
        error: FinalIllustrationError,
        action: FinalIllustrationAction,
        page_number: int | None = None,
    ) -> None:
        envelope = FinalIllustrationFailureEnvelope(
            jobId=job_id,
            type=_final_illustration_failed_type_for_action(action),
            storyId=story_id,
            pageNumber=page_number,
            error=error,
        )
        self._publish(
            exchange=settings.RABBITMQ_RESULT_EXCHANGE,
            routing_key=_final_illustration_failed_routing_key_for_action(action),
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


def _final_illustration_completed_type_for_action(action: FinalIllustrationAction) -> str:
    if action == "GENERATE":
        return "GENERATE_FINAL_ILLUSTRATION_COMPLETED"
    return "REVISE_FINAL_ILLUSTRATION_COMPLETED"


def _final_illustration_failed_type_for_action(action: FinalIllustrationAction) -> str:
    if action == "GENERATE":
        return "GENERATE_FINAL_ILLUSTRATION_FAILED"
    return "REVISE_FINAL_ILLUSTRATION_FAILED"


def _final_illustration_completed_routing_key_for_action(action: FinalIllustrationAction) -> str:
    if action == "GENERATE":
        return settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_COMPLETED_ROUTING_KEY
    return settings.RABBITMQ_FINAL_ILLUSTRATION_REVISE_COMPLETED_ROUTING_KEY


def _final_illustration_failed_routing_key_for_action(action: FinalIllustrationAction) -> str:
    if action == "GENERATE":
        return settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_FAILED_ROUTING_KEY
    return settings.RABBITMQ_FINAL_ILLUSTRATION_REVISE_FAILED_ROUTING_KEY
