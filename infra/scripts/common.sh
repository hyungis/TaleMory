#!/usr/bin/env bash
# Shared helpers used by all infra scripts.
# Source this file: `source "$(dirname "${BASH_SOURCE[0]}")/common.sh"`

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/srv/s210}"
PROJECT_NAME="${PROJECT_NAME:-s210}"
REGISTRY="${REGISTRY:-${CI_REGISTRY_IMAGE:-}}"

require_file() {
  local f="$1"
  [[ -f "$f" ]] || { echo "required file not found: $f" >&2; exit 1; }
}

image_ref() {
  local service="$1"
  local tag="$2"
  if [[ -z "$REGISTRY" ]]; then
    echo "REGISTRY is not set (expected CI_REGISTRY_IMAGE)" >&2
    exit 1
  fi
  echo "${REGISTRY}/${PROJECT_NAME}-${service}:${tag}"
}
