#!/usr/bin/env bash
# AI(FastAPI) 이미지 빌드 + push.
# Dockerfile은 소스 옆(app/ai/)에 있음 (Pattern A).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

TAG="${APP_IMAGE_TAG:-${CI_COMMIT_SHORT_SHA:?APP_IMAGE_TAG or CI_COMMIT_SHORT_SHA required}}"
IMG="$(image_ref ai "$TAG")"

docker build \
  -f app/ai/Dockerfile \
  -t "$IMG" \
  app/ai

docker push "$IMG"
echo "pushed: $IMG"
