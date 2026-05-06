import logging
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any

from app.core.config import settings
from app.mq.client import create_channel, create_connection, declare_ai_topology

logger = logging.getLogger(__name__)

WorkResult = bool | None
WorkerTask = Callable[[], WorkResult]
ApiTask = Callable[[], Any]
ApiResultHandler = Callable[[Any], WorkResult]
ApiErrorHandler = Callable[[BaseException], WorkResult]
ApiJobFactory = Callable[[], "ApiJob"]


@dataclass(frozen=True)
class ApiJob:
    task: ApiTask
    on_success: ApiResultHandler
    on_error: ApiErrorHandler | None = None

_worker_executor = ThreadPoolExecutor(max_workers=settings.AI_WORKER_CONCURRENCY)
_story_api_executor = ThreadPoolExecutor(max_workers=settings.AI_STORY_API_CONCURRENCY)
_gemini_image_api_executor = ThreadPoolExecutor(max_workers=settings.AI_GEMINI_IMAGE_API_CONCURRENCY)
_replicate_image_api_executor = ThreadPoolExecutor(max_workers=settings.AI_REPLICATE_IMAGE_API_CONCURRENCY)


def submit_message(
    *,
    consumer_channel: Any,
    delivery_tag: int,
    task: WorkerTask,
    task_name: str,
) -> None:
    _worker_executor.submit(_run_task, consumer_channel, delivery_tag, task, task_name)


def submit_story_api_message(
    *,
    consumer_channel: Any,
    delivery_tag: int,
    job_factory: ApiJobFactory,
    task_name: str,
) -> None:
    submit_api_message(
        consumer_channel=consumer_channel,
        delivery_tag=delivery_tag,
        job_factory=job_factory,
        task_name=task_name,
        api_executor=_story_api_executor,
    )


def submit_gemini_image_api_message(
    *,
    consumer_channel: Any,
    delivery_tag: int,
    job_factory: ApiJobFactory,
    task_name: str,
) -> None:
    submit_api_message(
        consumer_channel=consumer_channel,
        delivery_tag=delivery_tag,
        job_factory=job_factory,
        task_name=task_name,
        api_executor=_gemini_image_api_executor,
    )


def submit_replicate_image_api_message(
    *,
    consumer_channel: Any,
    delivery_tag: int,
    job_factory: ApiJobFactory,
    task_name: str,
) -> None:
    submit_api_message(
        consumer_channel=consumer_channel,
        delivery_tag=delivery_tag,
        job_factory=job_factory,
        task_name=task_name,
        api_executor=_replicate_image_api_executor,
    )


def submit_api_message(
    *,
    consumer_channel: Any,
    delivery_tag: int,
    job_factory: ApiJobFactory,
    task_name: str,
    api_executor: ThreadPoolExecutor,
) -> None:
    _worker_executor.submit(
        _prepare_api_task,
        consumer_channel,
        delivery_tag,
        job_factory,
        task_name,
        api_executor,
    )


def _prepare_api_task(
    consumer_channel: Any,
    delivery_tag: int,
    job_factory: ApiJobFactory,
    task_name: str,
    api_executor: ThreadPoolExecutor,
) -> None:
    try:
        job = job_factory()
        future = api_executor.submit(job.task)
        future.add_done_callback(
            lambda done: _worker_executor.submit(
                _finish_api_task,
                consumer_channel,
                delivery_tag,
                done,
                job,
                task_name,
            )
        )
    except Exception:
        logger.exception("%s failed before api task started", task_name)
        _schedule_nack(consumer_channel, delivery_tag)


def _finish_api_task(
    consumer_channel: Any,
    delivery_tag: int,
    future: Any,
    job: ApiJob,
    task_name: str,
) -> None:
    try:
        exc = future.exception()
        if exc is None:
            should_ack = job.on_success(future.result())
        elif job.on_error is not None:
            should_ack = job.on_error(exc)
        else:
            raise exc
    except Exception:
        logger.exception("%s failed after api task completed", task_name)
        _schedule_nack(consumer_channel, delivery_tag)
        return

    if should_ack is False:
        _schedule_nack(consumer_channel, delivery_tag)
    else:
        _schedule_ack(consumer_channel, delivery_tag)


def _run_task(
    consumer_channel: Any,
    delivery_tag: int,
    task: WorkerTask,
    task_name: str,
) -> None:
    try:
        should_ack = task()
    except Exception:
        logger.exception("%s failed with an unexpected worker error", task_name)
        _schedule_nack(consumer_channel, delivery_tag)
        return

    if should_ack is False:
        _schedule_nack(consumer_channel, delivery_tag)
    else:
        _schedule_ack(consumer_channel, delivery_tag)


def _schedule_ack(channel: Any, delivery_tag: int) -> None:
    channel.connection.add_callback_threadsafe(
        lambda: channel.basic_ack(delivery_tag=delivery_tag)
    )


def _schedule_nack(channel: Any, delivery_tag: int) -> None:
    channel.connection.add_callback_threadsafe(
        lambda: channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
    )


@contextmanager
def publisher_channel():
    connection = create_connection()
    channel = create_channel(connection)
    declare_ai_topology(channel)
    try:
        yield channel
    finally:
        if connection.is_open:
            connection.close()
