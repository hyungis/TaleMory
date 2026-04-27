from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings


class StorageConfigurationError(RuntimeError):
    """Raised when object storage is enabled but missing required settings."""


class StorageUploadError(RuntimeError):
    """Raised when an object upload fails."""


@dataclass(frozen=True)
class StoredAsset:
    url: str
    key: str | None = None


def storage_mode() -> str:
    return settings.TTS_STORAGE_MODE.strip().lower()


def build_storage_key(path: Path) -> str | None:
    if storage_mode() != "s3":
        return None

    relative = path.relative_to(settings.TTS_STORAGE_ROOT).as_posix()
    prefix = settings.AWS_S3_PREFIX.strip("/")
    if prefix:
        return f"{prefix}/{relative}"
    return relative


def build_public_url(path: Path) -> str:
    if storage_mode() == "s3":
        key = build_storage_key(path)
        if not key:
            raise StorageConfigurationError("Failed to resolve S3 object key")
        return _build_s3_public_url(key)

    relative = path.relative_to(settings.TTS_STORAGE_ROOT).as_posix()
    return f"{settings.TTS_PUBLIC_BASE_URL.rstrip('/')}/{relative}"


def store_bytes(path: Path, payload: bytes, content_type: str) -> StoredAsset:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)

    if storage_mode() != "s3":
        return StoredAsset(url=build_public_url(path))

    return _upload_file(path, content_type)


def store_file(path: Path, content_type: str) -> StoredAsset:
    if storage_mode() != "s3":
        return StoredAsset(url=build_public_url(path))

    return _upload_file(path, content_type)


@lru_cache
def _s3_client():
    if not settings.AWS_S3_BUCKET:
        raise StorageConfigurationError("AWS_S3_BUCKET must be configured when TTS_STORAGE_MODE=s3")

    client_kwargs: dict[str, str] = {"region_name": settings.AWS_REGION}
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        client_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        client_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    return boto3.client("s3", **client_kwargs)


def _upload_file(path: Path, content_type: str) -> StoredAsset:
    key = build_storage_key(path)
    if not key:
        raise StorageConfigurationError("Failed to resolve S3 object key")

    try:
        _s3_client().upload_file(
            str(path),
            settings.AWS_S3_BUCKET,
            key,
            ExtraArgs={"ContentType": content_type},
        )
    except (BotoCoreError, ClientError, OSError) as error:
        raise StorageUploadError(f"Failed to upload {path.name} to S3: {error}") from error

    return StoredAsset(url=_build_s3_public_url(key), key=key)


def _build_s3_public_url(key: str) -> str:
    if settings.AWS_S3_PUBLIC_BASE_URL:
        base_url = settings.AWS_S3_PUBLIC_BASE_URL.rstrip("/")
        return f"{base_url}/{key}"
    return f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
