import logging
import os

from app.consumers.final_illustration_consumer import register_final_illustration_consumers
from app.consumers.storyboard_consumer import register_storyboard_consumers
from app.consumers.storyboard_image_consumer import register_storyboard_image_consumers
from app.consumers.tts_consumer import register_tts_consumers
from app.mq.client import create_channel, create_connection, declare_storyboard_topology


def _configure_logging() -> None:
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-5s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    logging.getLogger("pika").setLevel(logging.WARNING)


def main() -> None:
    _configure_logging()
    logger = logging.getLogger(__name__)
    logger.info("ai-worker starting")
    connection = create_connection()
    channel = create_channel(connection)
    declare_storyboard_topology(channel)
    register_storyboard_consumers(channel)
    register_storyboard_image_consumers(channel)
    register_final_illustration_consumers(channel)
    register_tts_consumers(channel)
    logger.info("ai-worker ready")
    try:
        channel.start_consuming()
    finally:
        if connection.is_open:
            connection.close()


if __name__ == "__main__":
    main()
