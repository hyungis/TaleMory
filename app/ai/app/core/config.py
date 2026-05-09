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
    TTS_ENGINE: str = getenv("TTS_ENGINE", "cosyvoice")
    COSYVOICE_BASE_URL: str = getenv("COSYVOICE_BASE_URL", "")
    COSYVOICE_INSTRUCT_PATH: str = getenv("COSYVOICE_INSTRUCT_PATH", "/inference_instruct2")
    COSYVOICE_CROSS_LINGUAL_PATH: str = getenv("COSYVOICE_CROSS_LINGUAL_PATH", "/inference_cross_lingual")
    COSYVOICE_ZERO_SHOT_PATH: str = getenv("COSYVOICE_ZERO_SHOT_PATH", "/inference_zero_shot")
    COSYVOICE_TIMEOUT_SEC: float = float(getenv("COSYVOICE_TIMEOUT_SEC", "60"))
    QWEN_TTS_SERVER_URL: str = getenv("QWEN_TTS_SERVER_URL", "")
    QWEN_TTS_VOICE_CLONE_PATH: str = getenv("QWEN_TTS_VOICE_CLONE_PATH", "/tts/voice-clone")
    QWEN_TTS_TIMEOUT_SEC: float = float(getenv("QWEN_TTS_TIMEOUT_SEC", "300"))
    QWEN_TTS_X_VECTOR_ONLY_MODE: bool = getenv("QWEN_TTS_X_VECTOR_ONLY_MODE", "true").lower() == "true"
    TTS_STORAGE_ROOT: Path = Path(
        getenv("TTS_STORAGE_ROOT", str(Path(__file__).resolve().parents[2] / ".runtime" / "storage"))
    )
    TTS_MANIFEST_ROOT: Path = Path(
        getenv("TTS_MANIFEST_ROOT", str(Path(__file__).resolve().parents[2] / ".runtime" / "manifests"))
    )
    TTS_STORAGE_MODE: str = getenv("TTS_STORAGE_MODE", "local")
    TTS_PUBLIC_BASE_URL: str = getenv("TTS_PUBLIC_BASE_URL", "/static")
    TTS_DEFAULT_LANGUAGE: str = getenv("TTS_DEFAULT_LANGUAGE", "ko-KR")
    AWS_ACCESS_KEY_ID: str | None = getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: str | None = getenv("AWS_SECRET_ACCESS_KEY")
    AWS_REGION: str = getenv("AWS_REGION", "ap-northeast-2")
    AWS_S3_BUCKET: str = getenv("AWS_S3_BUCKET", "")
    AWS_S3_PREFIX: str = getenv("AWS_S3_PREFIX", "stories/tts")
    # 같은 버킷에서 환경(local/dev/prod) 격리용 — 모든 S3 key 앞에 prepend.
    # 미설정 시 default `local` — 로컬 개발자 사고 방지.
    AWS_S3_ENV_PREFIX: str = getenv("AWS_S3_ENV_PREFIX", "local")
    AWS_S3_PUBLIC_BASE_URL: str | None = getenv("AWS_S3_PUBLIC_BASE_URL")
    OPENAI_API_KEY: str | None = getenv("OPENAI_API_KEY")
    GEMINI_API_KEY: str | None = getenv("GEMINI_API_KEY", getenv("GOOGLE_API_KEY"))
    REPLICATE_API_TOKEN: str | None = getenv("REPLICATE_API_TOKEN")
    STORYBOARD_MODEL: str = getenv("STORYBOARD_MODEL", "gpt-4o-mini")
    WEBTOON_STORYBOARD_MODEL: str = getenv("WEBTOON_STORYBOARD_MODEL", "gpt-4o-mini")
    STORYBOARD_SUMMARY_MODEL: str = getenv("STORYBOARD_SUMMARY_MODEL", "gpt-5-nano")
    STORYBOARD_SUMMARY_REASONING_EFFORT: str = getenv(
        "STORYBOARD_SUMMARY_REASONING_EFFORT",
        "high",
    )
    STORYBOARD_IMAGE_MODEL: str = getenv("STORYBOARD_IMAGE_MODEL", "gemini-2.5-flash-image")
    WEBTOON_STORYBOARD_IMAGE_MODEL: str = getenv("WEBTOON_STORYBOARD_IMAGE_MODEL", "gemini-2.5-flash-image")
    STORYBOARD_IMAGE_INPUT_COST_PER_1M: float = float(
        getenv("STORYBOARD_IMAGE_INPUT_COST_PER_1M", "0.30")
    )
    STORYBOARD_IMAGE_OUTPUT_COST_PER_IMAGE: float = float(
        getenv("STORYBOARD_IMAGE_OUTPUT_COST_PER_IMAGE", "0.039")
    )
    FINAL_ILLUSTRATION_MODEL: str = getenv("FINAL_ILLUSTRATION_MODEL", "black-forest-labs/flux-2-klein-9b")
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
    AI_WORKER_CONCURRENCY: int = int(getenv("AI_WORKER_CONCURRENCY", "3"))
    AI_STORY_API_CONCURRENCY: int = int(getenv("AI_STORY_API_CONCURRENCY", "3"))
    AI_IMAGE_API_CONCURRENCY: int = int(getenv("AI_IMAGE_API_CONCURRENCY", "10"))
    AI_GEMINI_IMAGE_API_CONCURRENCY: int = int(getenv("AI_GEMINI_IMAGE_API_CONCURRENCY", "10"))
    AI_REPLICATE_IMAGE_API_CONCURRENCY: int = int(getenv("AI_REPLICATE_IMAGE_API_CONCURRENCY", "5"))
    RABBITMQ_PREFETCH_COUNT: int = int(getenv("RABBITMQ_PREFETCH_COUNT", "13"))
    RABBITMQ_REQUEST_EXCHANGE: str = getenv("RABBITMQ_REQUEST_EXCHANGE", "ai.request")
    RABBITMQ_RESULT_EXCHANGE: str = getenv("RABBITMQ_RESULT_EXCHANGE", "ai.result")
    RABBITMQ_GENERATE_QUEUE: str = getenv("RABBITMQ_GENERATE_QUEUE", "ai.cpu.story.generate.request.queue")
    RABBITMQ_SUMMARY_GENERATE_QUEUE: str = getenv(
        "RABBITMQ_SUMMARY_GENERATE_QUEUE",
        "ai.cpu.story.summary.generate.request.queue",
    )
    RABBITMQ_SUMMARY_REGENERATE_QUEUE: str = getenv(
        "RABBITMQ_SUMMARY_REGENERATE_QUEUE",
        "ai.cpu.story.summary.regenerate.request.queue",
    )
    RABBITMQ_SENTENCE_TRANSLATE_QUEUE: str = getenv(
        "RABBITMQ_SENTENCE_TRANSLATE_QUEUE",
        "ai.cpu.story.sentences.translate.request.queue",
    )
    RABBITMQ_REGENERATE_QUEUE: str = getenv("RABBITMQ_REGENERATE_QUEUE", "ai.cpu.story.regenerate.request.queue")
    RABBITMQ_TTS_GENERATE_QUEUE: str = getenv("RABBITMQ_TTS_GENERATE_QUEUE", "ai.gpu.request.queue")
    RABBITMQ_TTS_PREVIEW_QUEUE: str = getenv("RABBITMQ_TTS_PREVIEW_QUEUE", "ai.gpu.preview.request.queue")
    RABBITMQ_GENERATE_ROUTING_KEY: str = getenv("RABBITMQ_GENERATE_ROUTING_KEY", "ai.cpu.story.generate")
    RABBITMQ_SUMMARY_GENERATE_ROUTING_KEY: str = getenv(
        "RABBITMQ_SUMMARY_GENERATE_ROUTING_KEY",
        "ai.cpu.story.summary.generate",
    )
    RABBITMQ_SUMMARY_REGENERATE_ROUTING_KEY: str = getenv(
        "RABBITMQ_SUMMARY_REGENERATE_ROUTING_KEY",
        "ai.cpu.story.summary.regenerate",
    )
    RABBITMQ_SENTENCE_TRANSLATE_ROUTING_KEY: str = getenv(
        "RABBITMQ_SENTENCE_TRANSLATE_ROUTING_KEY",
        "ai.cpu.story.sentences.translate",
    )
    RABBITMQ_REGENERATE_ROUTING_KEY: str = getenv("RABBITMQ_REGENERATE_ROUTING_KEY", "ai.cpu.story.regenerate")
    RABBITMQ_TTS_GENERATE_ROUTING_KEY: str = getenv("RABBITMQ_TTS_GENERATE_ROUTING_KEY", "ai.gpu.tts.generate")
    RABBITMQ_TTS_PREVIEW_ROUTING_KEY: str = getenv("RABBITMQ_TTS_PREVIEW_ROUTING_KEY", "ai.gpu.tts.preview")
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
    RABBITMQ_FINAL_ILLUSTRATION_GENERATE_QUEUE: str = getenv(
        "RABBITMQ_FINAL_ILLUSTRATION_GENERATE_QUEUE",
        "ai.final-illustration.generate.request.queue",
    )
    RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_QUEUE: str = getenv(
        "RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_QUEUE",
        "ai.final-illustration.generate.item.request.queue",
    )
    RABBITMQ_FINAL_ILLUSTRATION_REVISE_QUEUE: str = getenv(
        "RABBITMQ_FINAL_ILLUSTRATION_REVISE_QUEUE",
        "ai.final-illustration.revise.request.queue",
    )
    RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ROUTING_KEY: str = getenv(
        "RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ROUTING_KEY",
        "ai.image.final-illustration.generate",
    )
    RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_ROUTING_KEY: str = getenv(
        "RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_ROUTING_KEY",
        "ai.image.final-illustration.generate.item",
    )
    RABBITMQ_FINAL_ILLUSTRATION_REVISE_ROUTING_KEY: str = getenv(
        "RABBITMQ_FINAL_ILLUSTRATION_REVISE_ROUTING_KEY",
        "ai.image.final-illustration.revise",
    )
    RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY",
        "ai.result.story.generate.completed",
    )
    RABBITMQ_SUMMARY_GENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_SUMMARY_GENERATE_COMPLETED_ROUTING_KEY",
        "ai.result.story.summary.generate.completed",
    )
    RABBITMQ_SUMMARY_REGENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_SUMMARY_REGENERATE_COMPLETED_ROUTING_KEY",
        "ai.result.story.summary.regenerate.completed",
    )
    RABBITMQ_SENTENCE_TRANSLATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_SENTENCE_TRANSLATE_COMPLETED_ROUTING_KEY",
        "ai.result.story.sentences.translate.completed",
    )
    RABBITMQ_GENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_GENERATE_FAILED_ROUTING_KEY",
        "ai.result.story.generate.failed",
    )
    RABBITMQ_SUMMARY_GENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_SUMMARY_GENERATE_FAILED_ROUTING_KEY",
        "ai.result.story.summary.generate.failed",
    )
    RABBITMQ_SUMMARY_REGENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_SUMMARY_REGENERATE_FAILED_ROUTING_KEY",
        "ai.result.story.summary.regenerate.failed",
    )
    RABBITMQ_SENTENCE_TRANSLATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_SENTENCE_TRANSLATE_FAILED_ROUTING_KEY",
        "ai.result.story.sentences.translate.failed",
    )
    RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY",
        "ai.result.story.regenerate.completed",
    )
    RABBITMQ_REGENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_REGENERATE_FAILED_ROUTING_KEY",
        "ai.result.story.regenerate.failed",
    )
    RABBITMQ_TTS_GENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_TTS_GENERATE_COMPLETED_ROUTING_KEY",
        "ai.result.tts.generate.completed",
    )
    RABBITMQ_TTS_GENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_TTS_GENERATE_FAILED_ROUTING_KEY",
        "ai.result.tts.generate.failed",
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
    RABBITMQ_FINAL_ILLUSTRATION_GENERATE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_FINAL_ILLUSTRATION_GENERATE_COMPLETED_ROUTING_KEY",
        "ai.result.final-illustration.generate.completed",
    )
    RABBITMQ_FINAL_ILLUSTRATION_GENERATE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_FINAL_ILLUSTRATION_GENERATE_FAILED_ROUTING_KEY",
        "ai.result.final-illustration.generate.failed",
    )
    RABBITMQ_FINAL_ILLUSTRATION_REVISE_COMPLETED_ROUTING_KEY: str = getenv(
        "RABBITMQ_FINAL_ILLUSTRATION_REVISE_COMPLETED_ROUTING_KEY",
        "ai.result.final-illustration.revise.completed",
    )
    RABBITMQ_FINAL_ILLUSTRATION_REVISE_FAILED_ROUTING_KEY: str = getenv(
        "RABBITMQ_FINAL_ILLUSTRATION_REVISE_FAILED_ROUTING_KEY",
        "ai.result.final-illustration.revise.failed",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
