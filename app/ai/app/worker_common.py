import logging
import os
from collections.abc import Callable
from typing import Any

from app.mq.client import create_channel, create_connection, declare_ai_topology


ConsumerRegistrar = Callable[[Any], None]


def configure_logging() -> None:
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-5s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    logging.getLogger("pika").setLevel(logging.WARNING)


def run_worker(name: str, register_consumers: ConsumerRegistrar) -> None:
    configure_logging()
    logger = logging.getLogger(__name__)
    logger.info("%s starting", name)
    connection = create_connection()
    channel = create_channel(connection)
    declare_ai_topology(channel)
    register_consumers(channel)
    logger.info("%s ready", name)
    try:
        channel.start_consuming()
    finally:
        if connection.is_open:
            connection.close()
