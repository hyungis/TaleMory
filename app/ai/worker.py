import logging
import os

from app.consumers.final_illustration_consumer import register_final_illustration_consumers
from app.consumers.storyboard_consumer import register_storyboard_consumers
from app.consumers.storyboard_image_consumer import register_storyboard_image_consumers
from app.mq.client import create_channel, create_connection, declare_storyboard_topology


def _configure_logging() -> None:
    # Python 기본 root logger 는 WARNING 이라 logger.info(...) 가 사일런트 드롭됨.
    # ai-worker 컨테이너는 stdout/stderr 가 곧 docker logs 라 핸들러도 stream 으로 명시.
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-5s %(name)s — %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    # noisy 라이브러리는 한 단계 낮춤 (필요 시 LOG_LEVEL 로 override).
    logging.getLogger("pika").setLevel(logging.WARNING)


if __name__ == "__main__":
    _configure_logging()
    logger = logging.getLogger(__name__)
    logger.info("ai-worker starting — registering storyboard + image consumers")
    connection = create_connection()
    channel = create_channel(connection)
    declare_storyboard_topology(channel)
    register_storyboard_consumers(channel)
    register_storyboard_image_consumers(channel)
    register_final_illustration_consumers(channel)
    logger.info("ai-worker ready — waiting for messages")
    try:
        channel.start_consuming()
    finally:
        if connection.is_open:
            connection.close()