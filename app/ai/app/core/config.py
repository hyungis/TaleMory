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
    STORYBOARD_MODEL: str = getenv("STORYBOARD_MODEL", "gpt-4o-mini")
    STORYBOARD_INPUT_COST_PER_1M: float = float(getenv("STORYBOARD_INPUT_COST_PER_1M", "0.15"))
    STORYBOARD_OUTPUT_COST_PER_1M: float = float(getenv("STORYBOARD_OUTPUT_COST_PER_1M", "0.60"))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
