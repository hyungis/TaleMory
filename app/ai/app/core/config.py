from functools import lru_cache
from os import getenv

from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = getenv("PROJECT_NAME", "S210 AI API")
    VERSION: str = getenv("APP_VERSION", "0.1.0")
    ENVIRONMENT: str = getenv("ENVIRONMENT", "local")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
