#!/usr/bin/env bash
# Shared helpers used by all infra scripts.
# Source this file: `source "$(dirname "${BASH_SOURCE[0]}")/common.sh"`

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/srv/s210}"
# IMAGE_PREFIX: Docker 이미지 이름 prefix. app.*.env의 PROJECT_NAME(AI 앱 표시명)과 별개.
IMAGE_PREFIX="${IMAGE_PREFIX:-s210}"

require_file() {
  local f="$1"
  [[ -f "$f" ]] || { echo "required file not found: $f" >&2; exit 1; }
}

# 로컬 이미지 태그. 배포 서버 docker daemon 안에서만 유효.
# 추후 registry 도입 시 이 함수에서 prefix 붙이고 build/deploy 스크립트에
# docker push/pull + login 한 줄씩 추가하면 됨.
image_ref() {
  local service="$1"
  local tag="$2"
  echo "${IMAGE_PREFIX}-${service}:${tag}"
}
