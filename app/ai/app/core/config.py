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
    APP_ROOT: Path = Path(__file__).resolve().parents[2]
    COSYVOICE_BASE_URL: str = getenv("COSYVOICE_BASE_URL", "")
    COSYVOICE_INSTRUCT_PATH: str = getenv("COSYVOICE_INSTRUCT_PATH", "/inference_instruct2")
    COSYVOICE_CROSS_LINGUAL_PATH: str = getenv("COSYVOICE_CROSS_LINGUAL_PATH", "/inference_cross_lingual")
    COSYVOICE_ZERO_SHOT_PATH: str = getenv("COSYVOICE_ZERO_SHOT_PATH", "/inference_zero_shot")
    COSYVOICE_TIMEOUT_SEC: float = float(getenv("COSYVOICE_TIMEOUT_SEC", "60"))
    TTS_STORAGE_ROOT: Path = Path(
        getenv("TTS_STORAGE_ROOT", str(Path(__file__).resolve().parents[2] / ".runtime" / "storage"))
    )
    TTS_MANIFEST_ROOT: Path = Path(
        getenv("TTS_MANIFEST_ROOT", str(Path(__file__).resolve().parents[2] / ".runtime" / "manifests"))
    )
    TTS_PUBLIC_BASE_URL: str = getenv("TTS_PUBLIC_BASE_URL", "/static")
    TTS_DEFAULT_LANGUAGE: str = getenv("TTS_DEFAULT_LANGUAGE", "ko-KR")
    OPENAI_API_KEY: str | None = getenv("OPENAI_API_KEY")
    STORYBOARD_MODEL: str = getenv("STORYBOARD_MODEL", "gpt-4o-mini")
    STORYBOARD_INPUT_COST_PER_1M: float = float(getenv("STORYBOARD_INPUT_COST_PER_1M", "0.15"))
    STORYBOARD_OUTPUT_COST_PER_1M: float = float(getenv("STORYBOARD_OUTPUT_COST_PER_1M", "0.60"))
    RABBITMQ_HOST: str = getenv("RABBITMQ_HOST", "localhost")
    RABBITMQ_PORT: int = int(getenv("RABBITMQ_PORT", "5672"))
    RABBITMQ_USER: str = getenv("RABBITMQ_USERNAME", getenv("RABBITMQ_USER", "guest"))
    RABBITMQ_PASSWORD: str = getenv("RABBITMQ_PASSWORD", "guest")
    RABBITMQ_VHOST: str = getenv("RABBITMQ_VHOST", "/")
    RABBITMQ_REQUEST_EXCHANGE: str = getenv("RABBITMQ_REQUEST_EXCHANGE", "storyboard.request")
    RABBITMQ_RESULT_EXCHANGE: str = getenv("RABBITMQ_RESULT_EXCHANGE", "storyboard.result")
    RABBITMQ_GENERATE_QUEUE: str = getenv("RABBITMQ_GENERATE_QUEUE", "storyboard.generate.request")
    RABBITMQ_REGENERATE_QUEUE: str = getenv("RABBITMQ_REGENERATE_QUEUE", "storyboard.regenerate.request")
    RABBITMQ_GENERATE_ROUTING_KEY: str = getenv("RABBITMQ_GENERATE_ROUTING_KEY", "storyboard.generate")
    RABBITMQ_REGENERATE_ROUTING_KEY: str = getenv("RABBITMQ_REGENERATE_ROUTING_KEY", "storyboard.regenerate")
    RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY",
        "storyboard.generate.completed",
    )
    RABBITMQ_GENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_GENERATE_FAILED_ROUTING_KEY",
        "storyboard.generate.failed",
    )
    RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY",
        "storyboard.regenerate.completed",
    )
    RABBITMQ_REGENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_REGENERATE_FAILED_ROUTING_KEY",
        "storyboard.regenerate.failed",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
