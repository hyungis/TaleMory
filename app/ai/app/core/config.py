from functools import lru_cache
from os import getenv
from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = getenv("PROJECT_NAME", "S210 AI API")
    VERSION: str = getenv("APP_VERSION", "0.1.0")
    ENVIRONMENT: str = getenv("ENVIRONMENT", "local")
    APP_ROOT: Path = Path(__file__).resolve().parents[2]
    COSYVOICE_BASE_URL: str = getenv("COSYVOICE_BASE_URL", "")
    COSYVOICE_INSTRUCT_PATH: str = getenv("COSYVOICE_INSTRUCT_PATH", "/inference_instruct2")
    COSYVOICE_TIMEOUT_SEC: float = float(getenv("COSYVOICE_TIMEOUT_SEC", "60"))
    TTS_STORAGE_ROOT: Path = Path(getenv("TTS_STORAGE_ROOT", str(Path(__file__).resolve().parents[2] / ".runtime" / "storage")))
    TTS_MANIFEST_ROOT: Path = Path(
        getenv("TTS_MANIFEST_ROOT", str(Path(__file__).resolve().parents[2] / ".runtime" / "manifests"))
    )
    TTS_PUBLIC_BASE_URL: str = getenv("TTS_PUBLIC_BASE_URL", "/static")
    TTS_DEFAULT_LANGUAGE: str = getenv("TTS_DEFAULT_LANGUAGE", "ko-KR")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
