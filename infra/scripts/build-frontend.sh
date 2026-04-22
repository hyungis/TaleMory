#!/usr/bin/env bash
# Frontend(=nginx 이미지) 로컬 빌드.
# multi-stage Dockerfile: React 빌드 → nginx 이미지에 dist 복사.
# 배포 서버 docker daemon에 태그만 남김(registry 미사용).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

TAG="${APP_IMAGE_TAG:-${CI_COMMIT_SHORT_SHA:?APP_IMAGE_TAG or CI_COMMIT_SHORT_SHA required}}"
IMG="$(image_ref frontend "$TAG")"

docker build \
  -f infra/docker/frontend.Dockerfile \
  --build-arg VITE_API_BASE_URL="${VITE_API_BASE_URL:-/api}" \
  -t "$IMG" \
  .

echo "built: $IMG"
