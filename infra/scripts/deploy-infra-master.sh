#!/usr/bin/env bash
# master(운영) 환경 base 인프라(MySQL/Redis/RabbitMQ) 수동 배포.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ENV_NAME="master"
COMPOSE_FILE="infra/compose/docker-compose.infra-${ENV_NAME}.yml"
COMPOSE_PROJECT="${PROJECT_NAME}-infra-${ENV_NAME}"
ENV_FILE="/tmp/env/infra.${ENV_NAME}.env"

require_file "$COMPOSE_FILE"
require_file "$ENV_FILE"

export COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" \
  up -d

echo "infra-${ENV_NAME} started"
