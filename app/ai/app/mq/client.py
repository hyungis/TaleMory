from typing import Any

import pika

from app.core.config import settings


def create_connection() -> Any:
    credentials = pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASSWORD)
    parameters = pika.ConnectionParameters(
        host=settings.RABBITMQ_HOST,
        port=settings.RABBITMQ_PORT,
        virtual_host=settings.RABBITMQ_VHOST,
        credentials=credentials,
    )
    return pika.BlockingConnection(parameters)


def create_channel(connection: Any) -> Any:
    channel = connection.channel()
    channel.basic_qos(prefetch_count=1)
    return channel


def declare_storyboard_topology(channel: Any) -> None:
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

    channel.queue_declare(queue=settings.RABBITMQ_TTS_RESULT_QUEUE, durable=True)
    channel.queue_bind(
        queue=settings.RABBITMQ_TTS_RESULT_QUEUE,
        exchange=settings.RABBITMQ_RESULT_EXCHANGE,
        routing_key=settings.RABBITMQ_TTS_RESULT_BINDING_KEY,
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
