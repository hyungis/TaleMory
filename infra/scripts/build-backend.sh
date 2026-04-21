#!/usr/bin/env bash
# Backend(Spring Boot) 이미지 빌드 + push.
# Dockerfile은 소스 옆(app/backend/)에 있음 (Pattern A).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

TAG="${APP_IMAGE_TAG:-${CI_COMMIT_SHORT_SHA:?APP_IMAGE_TAG or CI_COMMIT_SHORT_SHA required}}"
IMG="$(image_ref backend "$TAG")"

docker build \
  -f app/backend/Dockerfile \
  -t "$IMG" \
  app/backend

docker push "$IMG"
echo "pushed: $IMG"
