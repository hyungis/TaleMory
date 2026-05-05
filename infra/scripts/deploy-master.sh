#!/usr/bin/env bash
# master(운영) 환경 app 스택 배포. 인자 없으면 compose 정의 전체, 있으면 해당 서비스만.
# 실패 시 자동 복구는 하지 않음 — pipeline fail 로 표면화.
# 복구 경로: git revert → push → 새 pipeline, 또는 GitLab 변수 override 로 이전 SHA 재실행.
#
# 서비스명은 docker-compose.app-master.yml 의 services 키와 1:1 매칭. compose 에 새 서비스를
# 추가하면 스크립트 수정 없이 `all` 에 자동 포함된다.
#
# Usage:
#   bash infra/scripts/deploy-master.sh                       # 전체
#   bash infra/scripts/deploy-master.sh backend               # backend 만
#   bash infra/scripts/deploy-master.sh frontend              # nginx 별칭
#   bash infra/scripts/deploy-master.sh ai-tts-story-worker   # 임의의 단일 서비스

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

SERVICE="${1:-all}"
TAG="${APP_IMAGE_TAG:-${CI_COMMIT_SHORT_SHA:?APP_IMAGE_TAG or CI_COMMIT_SHORT_SHA required}}"
ENV_NAME="master"

COMPOSE_FILE="infra/compose/docker-compose.app-${ENV_NAME}.yml"
COMPOSE_PROJECT="${IMAGE_PREFIX}-app-${ENV_NAME}"
ENV_FILE="/tmp/env/app.${ENV_NAME}.env"

require_file "$COMPOSE_FILE"
require_file "$ENV_FILE"

export APP_IMAGE_TAG="$TAG"
export COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT"

compose_cmd() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" "$@"
}

ALL_SERVICES=$(compose_cmd config --services)

resolve_services() {
  case "$SERVICE" in
    all)
      echo "$ALL_SERVICES"
      ;;
    frontend)
      echo "nginx"
      ;;
    *)
      if echo "$ALL_SERVICES" | grep -qx "$SERVICE"; then
        echo "$SERVICE"
      else
        echo "unknown service: $SERVICE" >&2
        echo "available: $(echo "$ALL_SERVICES" | tr '\n' ' ')" >&2
        exit 1
      fi
      ;;
  esac
}

# shellcheck disable=SC2046
compose_cmd up -d --no-build $(resolve_services)

bash "$SCRIPT_DIR/health-check-${ENV_NAME}.sh" "$SERVICE"

echo "deploy-${ENV_NAME} OK ($SERVICE = $TAG)"
