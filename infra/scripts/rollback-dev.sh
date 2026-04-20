#!/usr/bin/env bash
# dev 환경 수동 롤백. state/last_ok_tag_<service>의 태그로 재배포 (state는 변경 없음).
#
# Usage:
#   bash infra/scripts/rollback-dev.sh [backend|frontend|ai|all]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

SERVICE="${1:-all}"
ENV_NAME="dev"
COMPOSE_FILE="infra/compose/docker-compose.app-${ENV_NAME}.yml"
COMPOSE_PROJECT="${PROJECT_NAME}-app-${ENV_NAME}"
ENV_FILE="/tmp/env/app.${ENV_NAME}.env"

require_file "$COMPOSE_FILE"
require_file "$ENV_FILE"
export COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT"

resolve_services() {
  case "$SERVICE" in
    all)              echo "backend ai nginx" ;;
    frontend|nginx)   echo "nginx" ;;
    backend|ai)       echo "$SERVICE" ;;
    *) echo "unknown service: $SERVICE" >&2; exit 1 ;;
  esac
}

for svc in $(resolve_services); do
  TAG="$(read_last_ok_tag "$ENV_NAME" "$svc")"
  echo "rolling back $svc to $TAG"
  APP_IMAGE_TAG="$TAG" docker compose --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" \
    up -d --no-build "$svc"
done

echo "rollback-${ENV_NAME} done"
