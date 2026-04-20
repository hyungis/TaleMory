#!/usr/bin/env bash
# master(운영) 환경 app 스택 배포. 실패 시 자동 롤백.
#
# Usage:
#   bash infra/scripts/deploy-master.sh [backend|frontend|ai|all]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

SERVICE="${1:-all}"
TAG="${APP_IMAGE_TAG:-${CI_COMMIT_SHORT_SHA:?APP_IMAGE_TAG or CI_COMMIT_SHORT_SHA required}}"
ENV_NAME="master"

COMPOSE_FILE="infra/compose/docker-compose.app-${ENV_NAME}.yml"
COMPOSE_PROJECT="${PROJECT_NAME}-app-${ENV_NAME}"
ENV_FILE="/tmp/env/app.${ENV_NAME}.env"

require_file "$COMPOSE_FILE"
require_file "$ENV_FILE"

export APP_IMAGE_TAG="$TAG"
export COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT"

resolve_services() {
  case "$SERVICE" in
    all)              echo "backend ai nginx" ;;
    frontend|nginx)   echo "nginx" ;;
    backend|ai)       echo "$SERVICE" ;;
    *) echo "unknown service: $SERVICE" >&2; exit 1 ;;
  esac
}

FAILURE_LOG_DIR=""
on_fail() {
  local ec=$?
  FAILURE_LOG_DIR="$(dump_failure_logs "$ENV_NAME" "$COMPOSE_FILE" "$COMPOSE_PROJECT")"
  echo "[FAIL] logs: $FAILURE_LOG_DIR" >&2
  for svc in $(resolve_services); do
    if prev="$(read_last_ok_tag "$ENV_NAME" "$svc" 2>/dev/null)"; then
      echo "rolling back $svc → $prev" >&2
      APP_IMAGE_TAG="$prev" docker compose \
        --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" \
        up -d --no-build "$svc" || true
    else
      echo "no last_ok_tag for $svc — leaving for inspection" >&2
    fi
  done
  export FAILURE_LOG_DIR
  exit "$ec"
}
trap on_fail ERR

for svc in $(resolve_services); do
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" \
    pull "$svc" || true
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" \
    up -d --no-build "$svc"
done

bash "$SCRIPT_DIR/health-check-${ENV_NAME}.sh" "$SERVICE"

for svc in $(resolve_services); do
  record_ok_tag "$ENV_NAME" "$svc" "$TAG"
done
echo "deploy-${ENV_NAME} OK ($SERVICE = $TAG)"
