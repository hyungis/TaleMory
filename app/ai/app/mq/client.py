import logging
import time
from typing import Any

import pika

from app.core.config import settings

logger = logging.getLogger(__name__)


# Windows 환경에서 pika 의 BlockingConnection 이 내부적으로 _nonblocking_socketpair() 를
# 호출하면서 간헐적으로 OSError(WinError 10014) 를 던지는 이슈가 있음.
# 다수의 connection 을 빠르게 만들 때 (e.g. storyboard image batch fan-out) 더 자주 발생.
# 0.15s 간격 retry 로 99% 통과. WSL/Linux 환경에선 retry 1번에 통과 또는 아예 발생 X.
_CONNECT_RETRY_ATTEMPTS = 5
_CONNECT_RETRY_DELAY_SEC = 0.15


def create_connection() -> Any:
    credentials = pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASSWORD)
    parameters = pika.ConnectionParameters(
        host=settings.RABBITMQ_HOST,
        port=settings.RABBITMQ_PORT,
        virtual_host=settings.RABBITMQ_VHOST,
        credentials=credentials,
        heartbeat=1200,
        blocked_connection_timeout=300,
    )
    last_exc: BaseException | None = None
    for attempt in range(1, _CONNECT_RETRY_ATTEMPTS + 1):
        try:
            return pika.BlockingConnection(parameters)
        except OSError as exc:
            last_exc = exc
            logger.warning(
                "create_connection attempt %d/%d failed: %s",
                attempt, _CONNECT_RETRY_ATTEMPTS, exc,
            )
            time.sleep(_CONNECT_RETRY_DELAY_SEC)
    # 마지막 시도까지 실패한 경우 마지막 예외를 그대로 raise.
    raise last_exc if last_exc else RuntimeError("create_connection failed without an exception")


def create_channel(connection: Any) -> Any:
    channel = connection.channel()
    channel.basic_qos(prefetch_count=settings.RABBITMQ_PREFETCH_COUNT)
    return channel


def declare_ai_topology(channel: Any) -> None:
    channel.exchange_declare(
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        exchange_type="topic",
        durable=True,
    )
    channel.exchange_declare(
        exchange=settings.RABBITMQ_RESULT_EXCHANGE,
        exchange_type="topic",
        durable=True,
    )

    channel.queue_declare(queue=settings.RABBITMQ_GENERATE_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_GENERATE_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_GENERATE_ROUTING_KEY,
    )

    channel.queue_declare(queue=settings.RABBITMQ_SUMMARY_GENERATE_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_SUMMARY_GENERATE_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_SUMMARY_GENERATE_ROUTING_KEY,
    )

    channel.queue_declare(queue=settings.RABBITMQ_SUMMARY_REGENERATE_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_SUMMARY_REGENERATE_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_SUMMARY_REGENERATE_ROUTING_KEY,
    )

    channel.queue_declare(queue=settings.RABBITMQ_SENTENCE_TRANSLATE_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_SENTENCE_TRANSLATE_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_SENTENCE_TRANSLATE_ROUTING_KEY,
    )

    channel.queue_declare(queue=settings.RABBITMQ_REGENERATE_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_REGENERATE_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_REGENERATE_ROUTING_KEY,
    )

    channel.queue_declare(queue=settings.RABBITMQ_TTS_GENERATE_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_TTS_GENERATE_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_TTS_GENERATE_ROUTING_KEY,
    )

    channel.queue_declare(queue=settings.RABBITMQ_TTS_PREVIEW_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_TTS_PREVIEW_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_TTS_PREVIEW_ROUTING_KEY,
    )

    channel.queue_declare(queue=settings.RABBITMQ_IMAGE_GENERATE_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_IMAGE_GENERATE_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_IMAGE_GENERATE_ROUTING_KEY,
    )

    channel.queue_declare(queue=settings.RABBITMQ_IMAGE_GENERATE_ITEM_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_IMAGE_GENERATE_ITEM_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_IMAGE_GENERATE_ITEM_ROUTING_KEY,
    )

    channel.queue_declare(queue=settings.RABBITMQ_IMAGE_REGENERATE_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_IMAGE_REGENERATE_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_IMAGE_REGENERATE_ROUTING_KEY,
    )

    channel.queue_declare(queue=settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ROUTING_KEY,
    )

    channel.queue_declare(queue=settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_ROUTING_KEY,
    )

    channel.queue_declare(queue=settings.RABBITMQ_FINAL_ILLUSTRATION_REVISE_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_FINAL_ILLUSTRATION_REVISE_QUEUE,
        exchange=settings.RABBITMQ_REQUEST_EXCHANGE,
        routing_key=settings.RABBITMQ_FINAL_ILLUSTRATION_REVISE_ROUTING_KEY,
    )
