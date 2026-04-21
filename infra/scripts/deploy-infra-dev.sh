#!/usr/bin/env bash
# dev 환경 base 인프라(MySQL/Redis/RabbitMQ) 수동 배포.
# 인프라 compose는 앱과 분리되어 상시 상주 — 변경 있을 때만 실행.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ENV_NAME="dev"
COMPOSE_FILE="infra/compose/docker-compose.infra-${ENV_NAME}.yml"
COMPOSE_PROJECT="${PROJECT_NAME}-infra-${ENV_NAME}"
ENV_FILE="/tmp/env/infra.${ENV_NAME}.env"

require_file "$COMPOSE_FILE"
require_file "$ENV_FILE"

export COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" \
  up -d

echo "infra-${ENV_NAME} started"
