#!/usr/bin/env bash
# dev 환경 app 스택 배포. 인자 없으면 전체, 있으면 해당 서비스만.
# 실패 시 자동 복구는 하지 않음 — pipeline fail로 표면화.
# 복구 경로: git revert → push → 새 pipeline, 또는 GitLab 변수 override로 이전 SHA 재실행.
#
# Usage:
#   bash infra/scripts/deploy-dev.sh                # backend + ai + nginx 전부
#   bash infra/scripts/deploy-dev.sh backend        # backend만
#   bash infra/scripts/deploy-dev.sh frontend       # nginx만 (이름 매핑)
#   bash infra/scripts/deploy-dev.sh ai             # ai만

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

SERVICE="${1:-all}"
TAG="${APP_IMAGE_TAG:-${CI_COMMIT_SHORT_SHA:?APP_IMAGE_TAG or CI_COMMIT_SHORT_SHA required}}"
ENV_NAME="dev"

COMPOSE_FILE="infra/compose/docker-compose.app-${ENV_NAME}.yml"
COMPOSE_PROJECT="${PROJECT_NAME}-app-${ENV_NAME}"
ENV_FILE="/tmp/env/app.${ENV_NAME}.env"

require_file "$COMPOSE_FILE"
require_file "$ENV_FILE"

export APP_IMAGE_TAG="$TAG"
export COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT"

# frontend(별칭) → 실제 compose 서비스명은 nginx
resolve_services() {
  case "$SERVICE" in
    all)              echo "backend ai nginx" ;;
    frontend|nginx)   echo "nginx" ;;
    backend|ai)       echo "$SERVICE" ;;
    *) echo "unknown service: $SERVICE" >&2; exit 1 ;;
  esac
}

for svc in $(resolve_services); do
  # build 단계에서 이미 로컬 docker daemon에 s210-<svc>:<tag> 태그가 있음.
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" \
    up -d --no-build "$svc"
done

bash "$SCRIPT_DIR/health-check-${ENV_NAME}.sh" "$SERVICE"

echo "deploy-${ENV_NAME} OK ($SERVICE = $TAG)"
