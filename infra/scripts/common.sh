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

state_dir() {
  local env_name="$1"
  echo "$ROOT_DIR/$env_name/state"
}

logs_dir() {
  local env_name="$1"
  local ts="$2"
  echo "$ROOT_DIR/$env_name/logs/$ts"
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

current_running_tag() {
  local container="$1"
  docker inspect --format='{{.Config.Image}}' "$container" 2>/dev/null \
    | awk -F':' '{print $NF}' \
    || echo "unknown"
}

record_ok_tag() {
  local env_name="$1"
  local service="$2"
  local tag="$3"
  local dir
  dir="$(state_dir "$env_name")"
  mkdir -p "$dir"
  local cur_file="$dir/last_ok_tag_${service}"
  local prev_file="$dir/previous_ok_tag_${service}"
  if [[ -f "$cur_file" ]]; then
    cp "$cur_file" "$prev_file"
  fi
  printf '%s' "$tag" > "$cur_file"
  echo "recorded OK tag for $env_name/$service = $tag"
}

read_last_ok_tag() {
  local env_name="$1"
  local service="$2"
  local f
  f="$(state_dir "$env_name")/last_ok_tag_${service}"
  [[ -f "$f" ]] || { echo "no last_ok_tag for $env_name/$service" >&2; return 1; }
  cat "$f"
}

dump_failure_logs() {
  local env_name="$1"
  local compose_file="$2"
  local project_name="$3"
  local ts
  ts="$(date +%Y%m%d-%H%M%S)"
  local dir
  dir="$(logs_dir "$env_name" "$ts")"
  mkdir -p "$dir"
  docker compose -f "$compose_file" -p "$project_name" ps \
    > "$dir/ps.txt" 2>&1 || true
  docker compose -f "$compose_file" -p "$project_name" logs --no-color --tail=500 \
    > "$dir/compose.log" 2>&1 || true
  echo "$dir"
}
