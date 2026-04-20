#!/usr/bin/env bash
# Frontend(=nginx 이미지) 빌드 + registry push.
# multi-stage Dockerfile이라 React 빌드가 이미지 빌드 과정 안에서 일어남.

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

docker push "$IMG"
echo "pushed: $IMG"
