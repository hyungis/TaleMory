from functools import lru_cache
from os import environ, getenv
from pathlib import Path

from pydantic import BaseModel


def load_local_env() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env()


class Settings(BaseModel):
    PROJECT_NAME: str = getenv("PROJECT_NAME", "S210 AI API")
    VERSION: str = getenv("APP_VERSION", "0.1.0")
    ENVIRONMENT: str = getenv("ENVIRONMENT", "local")
    OPENAI_API_KEY: str | None = getenv("OPENAI_API_KEY")
    GEMINI_API_KEY: str | None = getenv("GEMINI_API_KEY", getenv("GOOGLE_API_KEY"))
    STORYBOARD_MODEL: str = getenv("STORYBOARD_MODEL", "gpt-4o-mini")
    STORYBOARD_SUMMARY_MODEL: str = getenv("STORYBOARD_SUMMARY_MODEL", "gpt-5-nano")
    STORYBOARD_SUMMARY_REASONING_EFFORT: str = getenv(
        "STORYBOARD_SUMMARY_REASONING_EFFORT",
        "high",
    )
    STORYBOARD_IMAGE_MODEL: str = getenv("STORYBOARD_IMAGE_MODEL", "gemini-2.5-flash-image")
    STORYBOARD_IMAGE_S3_BUCKET: str | None = getenv("STORYBOARD_IMAGE_S3_BUCKET", getenv("AWS_S3_BUCKET"))
    STORYBOARD_IMAGE_S3_REGION: str | None = getenv("STORYBOARD_IMAGE_S3_REGION", getenv("AWS_REGION"))
    STORYBOARD_IMAGE_S3_ACCESS_KEY_ID: str | None = getenv(
        "STORYBOARD_IMAGE_S3_ACCESS_KEY_ID",
        getenv("AWS_ACCESS_KEY_ID"),
    )
    STORYBOARD_IMAGE_S3_SECRET_ACCESS_KEY: str | None = getenv(
        "STORYBOARD_IMAGE_S3_SECRET_ACCESS_KEY",
        getenv("AWS_SECRET_ACCESS_KEY"),
    )
    STORYBOARD_IMAGE_S3_ENDPOINT_URL: str | None = getenv("STORYBOARD_IMAGE_S3_ENDPOINT_URL")
    STORYBOARD_IMAGE_PUBLIC_BASE_URL: str | None = getenv("STORYBOARD_IMAGE_PUBLIC_BASE_URL")
    STORYBOARD_INPUT_COST_PER_1M: float = float(getenv("STORYBOARD_INPUT_COST_PER_1M", "0.15"))
    STORYBOARD_OUTPUT_COST_PER_1M: float = float(getenv("STORYBOARD_OUTPUT_COST_PER_1M", "0.60"))
    STORYBOARD_SUMMARY_INPUT_COST_PER_1M: float = float(
        getenv("STORYBOARD_SUMMARY_INPUT_COST_PER_1M", "0.05"),
    )
    STORYBOARD_SUMMARY_OUTPUT_COST_PER_1M: float = float(
        getenv("STORYBOARD_SUMMARY_OUTPUT_COST_PER_1M", "0.40"),
    )
    AWS_REGION: str | None = getenv("AWS_REGION")
    AWS_S3_BUCKET: str | None = getenv("AWS_S3_BUCKET")
    AWS_ACCESS_KEY_ID: str | None = getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: str | None = getenv("AWS_SECRET_ACCESS_KEY")
    RABBITMQ_HOST: str = getenv("RABBITMQ_HOST", "localhost")
    RABBITMQ_PORT: int = int(getenv("RABBITMQ_PORT", "5672"))
    RABBITMQ_USER: str = getenv("RABBITMQ_USERNAME", getenv("RABBITMQ_USER", "guest"))
    RABBITMQ_PASSWORD: str = getenv("RABBITMQ_PASSWORD", "guest")
    RABBITMQ_VHOST: str = getenv("RABBITMQ_VHOST", "/")
    RABBITMQ_REQUEST_EXCHANGE: str = getenv("RABBITMQ_REQUEST_EXCHANGE", "ai.request")
    RABBITMQ_RESULT_EXCHANGE: str = getenv("RABBITMQ_RESULT_EXCHANGE", "ai.result")
    RABBITMQ_GENERATE_QUEUE: str = getenv("RABBITMQ_GENERATE_QUEUE", "ai.cpu.request.queue")
    RABBITMQ_SUMMARY_GENERATE_QUEUE: str = getenv(
        "RABBITMQ_SUMMARY_GENERATE_QUEUE",
        "ai.cpu.story.summary.request.queue",
    )
    RABBITMQ_REGENERATE_QUEUE: str = getenv("RABBITMQ_REGENERATE_QUEUE", "ai.cpu.regenerate.queue")
    RABBITMQ_GENERATE_ROUTING_KEY: str = getenv("RABBITMQ_GENERATE_ROUTING_KEY", "ai.cpu.story.generate")
    RABBITMQ_SUMMARY_GENERATE_ROUTING_KEY: str = getenv(
        "RABBITMQ_SUMMARY_GENERATE_ROUTING_KEY",
        "ai.cpu.story.summary.generate",
    )
    RABBITMQ_REGENERATE_ROUTING_KEY: str = getenv("RABBITMQ_REGENERATE_ROUTING_KEY", "ai.cpu.story.regenerate")
    RABBITMQ_IMAGE_GENERATE_QUEUE: str = getenv(
        "RABBITMQ_IMAGE_GENERATE_QUEUE",
        "ai.image.generate.request.queue",
    )
    RABBITMQ_IMAGE_GENERATE_ITEM_QUEUE: str = getenv(
        "RABBITMQ_IMAGE_GENERATE_ITEM_QUEUE",
        "ai.image.generate.item.request.queue",
    )
    RABBITMQ_IMAGE_REGENERATE_QUEUE: str = getenv(
        "RABBITMQ_IMAGE_REGENERATE_QUEUE",
        "ai.image.regenerate.request.queue",
    )
    RABBITMQ_IMAGE_GENERATE_ROUTING_KEY: str = getenv(
        "RABBITMQ_IMAGE_GENERATE_ROUTING_KEY",
        "ai.image.generate",
    )
    RABBITMQ_IMAGE_GENERATE_ITEM_ROUTING_KEY: str = getenv(
        "RABBITMQ_IMAGE_GENERATE_ITEM_ROUTING_KEY",
        "ai.image.generate.item",
    )
    RABBITMQ_IMAGE_REGENERATE_ROUTING_KEY: str = getenv(
        "RABBITMQ_IMAGE_REGENERATE_ROUTING_KEY",
        "ai.image.regenerate",
    )
    RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY",
        "ai.result.story.generate.completed",
    )
    RABBITMQ_SUMMARY_GENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_SUMMARY_GENERATE_COMPLETED_ROUTING_KEY",
        "ai.result.story.summary.generate.completed",
    )
    RABBITMQ_GENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_GENERATE_FAILED_ROUTING_KEY",
        "ai.result.story.generate.failed",
    )
    RABBITMQ_SUMMARY_GENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_SUMMARY_GENERATE_FAILED_ROUTING_KEY",
        "ai.result.story.summary.generate.failed",
    )
    RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY",
        "ai.result.story.regenerate.completed",
    )
    RABBITMQ_REGENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_REGENERATE_FAILED_ROUTING_KEY",
        "ai.result.story.regenerate.failed",
    )
    RABBITMQ_IMAGE_GENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_IMAGE_GENERATE_COMPLETED_ROUTING_KEY",
        "ai.result.image.generate.completed",
    )
    RABBITMQ_IMAGE_GENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_IMAGE_GENERATE_FAILED_ROUTING_KEY",
        "ai.result.image.generate.failed",
    )
    RABBITMQ_IMAGE_REGENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_IMAGE_REGENERATE_COMPLETED_ROUTING_KEY",
        "ai.result.image.regenerate.completed",
    )
    RABBITMQ_IMAGE_REGENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_IMAGE_REGENERATE_FAILED_ROUTING_KEY",
        "ai.result.image.regenerate.failed",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
