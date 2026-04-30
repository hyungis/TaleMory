import json
import logging
from typing import Any

import pika

from app.core.config import settings
from app.mq.publisher import TtsResultPublisher
from app.schemas.mq_tts import StoryTtsGenerateJobMessage, StoryTtsResultPayload, TtsError
from app.schemas.mq_tts_preview import (
    PreviewTtsError,
    PreviewTtsJobMessage,
    PreviewTtsRpcResponse,
    PreviewTtsResultPayload,
)
from app.services.cosyvoice_client import CosyVoiceInvocationError, CosyVoiceNotConfiguredError
from app.services.dev_tts_service import (
    create_pending_manifest,
    generate_preview,
    generate_story_tts_result,
    update_manifest,
)
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
    channel.basic_consume(
        queue=settings.RABBITMQ_TTS_PREVIEW_QUEUE,
        on_message_callback=lambda ch, method, properties, body: _dispatch_preview_message(
            ch,
            method.delivery_tag,
            properties,
            body,
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


def _dispatch_preview_message(
    channel: Any,
    delivery_tag: int,
    properties: pika.BasicProperties | None,
    body: bytes,
) -> None:
    try:
        response = handle_preview_message(body)
        _publish_preview_reply(channel, properties, response)
    except Exception:
        logger.exception("Unexpected error while processing preview TTS message")
        _publish_preview_reply(
            channel,
            properties,
            PreviewTtsRpcResponse(
                success=False,
                error=PreviewTtsError(
                    code="GENERATE_TTS_UNEXPECTED_ERROR",
                    message="Unexpected worker error",
                ),
            ),
        )
    finally:
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


def handle_preview_message(body: bytes) -> PreviewTtsRpcResponse:
    message = PreviewTtsJobMessage.model_validate_json(body)
    request = message.payload

    try:
        result = generate_preview(
            message.voiceId,
            request.text,
            request.language,
            request.format,
            request.options,
            request.referenceAudioUrl,
            request.referenceAudioS3Key,
        )
    except FileNotFoundError as exc:
        return PreviewTtsRpcResponse(
            success=False,
            error=PreviewTtsError(code="GENERATE_TTS_VOICE_NOT_FOUND", message=f"Voice not found: {exc}"),
        )
    except CosyVoiceNotConfiguredError as exc:
        return PreviewTtsRpcResponse(
            success=False,
            error=PreviewTtsError(code="GENERATE_TTS_NOT_CONFIGURED", message=str(exc)),
        )
    except CosyVoiceInvocationError as exc:
        return PreviewTtsRpcResponse(
            success=False,
            error=PreviewTtsError(code="GENERATE_TTS_ENGINE_ERROR", message=str(exc)),
        )
    except (StorageConfigurationError, StorageDownloadError, StorageUploadError) as exc:
        return PreviewTtsRpcResponse(
            success=False,
            error=PreviewTtsError(code="GENERATE_TTS_STORAGE_ERROR", message=str(exc)),
        )
    except ValueError as exc:
        return PreviewTtsRpcResponse(
            success=False,
            error=PreviewTtsError(code="GENERATE_TTS_ERROR", message=str(exc)),
        )

    audio = result["audio"]
    return PreviewTtsRpcResponse(
        success=True,
        data=PreviewTtsResultPayload(
            audioUrl=audio["audioUrl"],
            s3Key=audio["s3Key"],
            durationMs=audio["durationMs"],
        ),
    )


def _publish_preview_reply(
    channel: Any,
    properties: pika.BasicProperties | None,
    response: PreviewTtsRpcResponse,
) -> None:
    if properties is None or not properties.reply_to:
        logger.warning("Preview RPC reply_to missing; dropping response")
        return

    channel.basic_publish(
        exchange="",
        routing_key=properties.reply_to,
        body=response.model_dump_json().encode("utf-8"),
        properties=pika.BasicProperties(
            content_type="application/json",
            correlation_id=properties.correlation_id,
            delivery_mode=1,
        ),
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
