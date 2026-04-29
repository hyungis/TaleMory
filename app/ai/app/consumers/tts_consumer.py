import json
import logging
from typing import Any

from app.core.config import settings
from app.mq.publisher import TtsResultPublisher
from app.schemas.mq_tts import StoryTtsGenerateJobMessage, StoryTtsResultPayload, TtsError
from app.services.cosyvoice_client import CosyVoiceInvocationError, CosyVoiceNotConfiguredError
from app.services.dev_tts_service import create_pending_manifest, generate_story_tts_result, update_manifest
from app.services.storage_service import StorageConfigurationError, StorageDownloadError, StorageUploadError

logger = logging.getLogger(__name__)


def consume_tts_jobs() -> None:
    from app.mq.client import create_channel, create_connection, declare_storyboard_topology

    connection = create_connection()
    channel = create_channel(connection)
    declare_storyboard_topology(channel)
    register_tts_consumers(channel)
    try:
        channel.start_consuming()
    finally:
        if connection.is_open:
            connection.close()


def register_tts_consumers(channel: Any) -> None:
    publisher = TtsResultPublisher(channel)
    channel.basic_consume(
        queue=settings.RABBITMQ_TTS_GENERATE_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_generate_message(
            ch, method.delivery_tag, body, publisher
        ),
    )


def _dispatch_generate_message(
    channel: Any,
    delivery_tag: int,
    body: bytes,
    publisher: TtsResultPublisher,
) -> None:
    try:
        handle_generate_message(body=body, publisher=publisher)
    except Exception:
        logger.exception("Unexpected error while processing story TTS message")
        if _publish_unexpected_failure(body, publisher):
            channel.basic_ack(delivery_tag=delivery_tag)
            return
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
    else:
        channel.basic_ack(delivery_tag=delivery_tag)


def handle_generate_message(body: bytes, publisher: TtsResultPublisher) -> None:
    message = StoryTtsGenerateJobMessage.model_validate_json(body)
    request = message.payload.model_dump(mode="json")
    if message.storyId is not None:
        request["storyId"] = message.storyId

    create_pending_manifest(
        message.jobId,
        "TTS",
        {"storyId": request["storyId"], "voiceId": request["voiceId"]},
    )
    update_manifest(
        message.jobId,
        {"status": "RUNNING", "startedAt": _now(), "progress": 5},
    )

    try:
        result = generate_story_tts_result(
            request,
            progress_callback=lambda progress: update_manifest(message.jobId, {"progress": progress}),
        )
    except FileNotFoundError as exc:
        _handle_failure(
            publisher,
            message.jobId,
            request["storyId"],
            "GENERATE_TTS_VOICE_NOT_FOUND",
            f"Voice not found: {exc}",
        )
        update_manifest(
            message.jobId,
            {"status": "FAILED", "finishedAt": _now(), "error": {"message": f"Voice not found: {exc}"}},
        )
        return
    except CosyVoiceNotConfiguredError as exc:
        _handle_failure(
            publisher,
            message.jobId,
            request["storyId"],
            "GENERATE_TTS_NOT_CONFIGURED",
            str(exc),
        )
        update_manifest(
            message.jobId,
            {"status": "FAILED", "finishedAt": _now(), "error": {"message": str(exc)}},
        )
        return
    except CosyVoiceInvocationError as exc:
        _handle_failure(
            publisher,
            message.jobId,
            request["storyId"],
            "GENERATE_TTS_ENGINE_ERROR",
            str(exc),
        )
        update_manifest(
            message.jobId,
            {"status": "FAILED", "finishedAt": _now(), "error": {"message": str(exc)}},
        )
        return
    except (StorageConfigurationError, StorageDownloadError, StorageUploadError) as exc:
        _handle_failure(
            publisher,
            message.jobId,
            request["storyId"],
            "GENERATE_TTS_STORAGE_ERROR",
            str(exc),
        )
        update_manifest(
            message.jobId,
            {"status": "FAILED", "finishedAt": _now(), "error": {"message": str(exc)}},
        )
        return
    except ValueError as exc:
        _handle_failure(
            publisher,
            message.jobId,
            request["storyId"],
            "GENERATE_TTS_ERROR",
            str(exc),
        )
        update_manifest(
            message.jobId,
            {"status": "FAILED", "finishedAt": _now(), "error": {"message": str(exc)}},
        )
        return

    typed_result = StoryTtsResultPayload.model_validate(result)
    publisher.publish_result(
        job_id=message.jobId,
        story_id=request["storyId"],
        payload=typed_result,
    )
    update_manifest(
        message.jobId,
        {
            "status": "SUCCESS",
            "finishedAt": _now(),
            "progress": 100,
            "result": result,
        },
    )


def _handle_failure(
    publisher: TtsResultPublisher,
    job_id: str,
    story_id: int | None,
    code: str,
    message: str,
) -> None:
    publisher.publish_failure(
        job_id=job_id,
        story_id=story_id,
        error=TtsError(code=code, message=message),
    )


def _publish_unexpected_failure(body: bytes, publisher: TtsResultPublisher) -> bool:
    try:
        payload = json.loads(body.decode("utf-8"))
        publisher.publish_failure(
            job_id=payload["jobId"],
            story_id=payload.get("storyId"),
            error=TtsError(code="GENERATE_TTS_UNEXPECTED_ERROR", message="Unexpected worker error"),
        )
        return True
    except Exception:
        logger.exception("Failed to publish unexpected story TTS failure event")
        return False


def _now() -> str:
    from app.services.dev_tts_service import _now as manifest_now

    return manifest_now()
