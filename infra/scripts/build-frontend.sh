#!/usr/bin/env bash
# Frontend(=nginx 이미지) 로컬 빌드.
# multi-stage Dockerfile: React 빌드 → nginx 이미지에 dist 복사.
# 배포 서버 docker daemon에 태그만 남김(registry 미사용).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

TAG="${APP_IMAGE_TAG:-${CI_COMMIT_SHORT_SHA:?APP_IMAGE_TAG or CI_COMMIT_SHORT_SHA required}}"
IMG="$(image_ref frontend "$TAG")"
TARGET_ENV="${CI_COMMIT_BRANCH:-}"
APP_ENV_FILE="/tmp/env/app.${TARGET_ENV}.env"

read_env_value() {
  local key="$1"
  local file="$2"
  local line

  line="$(grep -m 1 "^${key}=" "$file" 2>/dev/null || true)"
  if [[ -n "$line" ]]; then
    printf '%s' "${line#*=}"
  fi
}

if [[ "$TARGET_ENV" == "dev" || "$TARGET_ENV" == "master" ]] && [[ -f "$APP_ENV_FILE" ]]; then
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-$(read_env_value VITE_API_BASE_URL "$APP_ENV_FILE")}"
  VITE_KAKAO_CLIENT_ID="${VITE_KAKAO_CLIENT_ID:-$(read_env_value VITE_KAKAO_CLIENT_ID "$APP_ENV_FILE")}"
fi

docker build \
  -f infra/docker/frontend.Dockerfile \
  --build-arg VITE_API_BASE_URL="${VITE_API_BASE_URL:-/api}" \
  --build-arg VITE_KAKAO_CLIENT_ID="${VITE_KAKAO_CLIENT_ID:-}" \
  -t "$IMG" \
  .

echo "built: $IMG"
