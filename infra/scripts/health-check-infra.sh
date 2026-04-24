#!/usr/bin/env bash
# infra(mysql/redis/rabbitmq) 상태 + 자격증명 검증.
# deploy-infra-<env>.sh 직후에 호출. 실제 컨테이너에 접속을 시도해:
#   1. generate-env.sh가 만든 env 파일이 실 컨테이너 기동 값과 일치하는지
#   2. app-side 자격증명(app.<env>.env) == infra-side(infra.<env>.env) 인지
# 둘 다 검증한다.
#
# Usage:
#   bash infra/scripts/health-check-infra.sh dev
#   bash infra/scripts/health-check-infra.sh master
#
# 요구사항:
#   - infra-<env> 스택이 이미 `up -d` 상태
#   - docker daemon 사용 가능 (runner = deploy 서버)
#   - /tmp/env/infra.<env>.env, /tmp/env/app.<env>.env 존재 (generate-env.sh 결과)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ENV_NAME="${1:?usage: $0 <dev|master>}"

# master → prod-* 컨테이너/네트워크 prefix 매핑
case "$ENV_NAME" in
  dev)    HOST_PREFIX="dev" ;;
  master) HOST_PREFIX="prod" ;;
  *) echo "unknown env: $ENV_NAME (expected dev|master)" >&2; exit 1 ;;
esac

NETWORK="${HOST_PREFIX}-${IMAGE_PREFIX}-infra-net"
ENV_DIR_LOCAL="${ENV_DIR:-/tmp/env}"
INFRA_ENV="$ENV_DIR_LOCAL/infra.${ENV_NAME}.env"
APP_ENV="$ENV_DIR_LOCAL/app.${ENV_NAME}.env"

require_file "$INFRA_ENV"
require_file "$APP_ENV"

# key=value 파일에서 값만 안전 추출(셸 확장 회피).
get_env() {
  local key="$1" file="$2"
  grep -E "^${key}=" "$file" | head -1 | cut -d= -f2-
}

# ── infra 쪽 값 (컨테이너 기동에 사용된 값) ─────────────
MYSQL_USER_I=$(get_env MYSQL_USER "$INFRA_ENV")
MYSQL_PASSWORD_I=$(get_env MYSQL_PASSWORD "$INFRA_ENV")
MYSQL_DATABASE_I=$(get_env MYSQL_DATABASE "$INFRA_ENV")
REDIS_PASSWORD_I=$(get_env REDIS_PASSWORD "$INFRA_ENV")
RABBITMQ_USER_I=$(get_env RABBITMQ_DEFAULT_USER "$INFRA_ENV")
RABBITMQ_PASS_I=$(get_env RABBITMQ_DEFAULT_PASS "$INFRA_ENV")

# ── app 쪽 값 (백엔드가 접속에 사용할 값) ────────────────
DB_USERNAME_A=$(get_env DB_USERNAME "$APP_ENV")
DB_PASSWORD_A=$(get_env DB_PASSWORD "$APP_ENV")
REDIS_PASSWORD_A=$(get_env REDIS_PASSWORD "$APP_ENV")
RABBITMQ_USER_A=$(get_env RABBITMQ_USERNAME "$APP_ENV")
RABBITMQ_PASS_A=$(get_env RABBITMQ_PASSWORD "$APP_ENV")

# ── 존재 검증 ────────────────────────────────────────────
REQUIRED=(MYSQL_USER_I MYSQL_PASSWORD_I MYSQL_DATABASE_I REDIS_PASSWORD_I
          RABBITMQ_USER_I RABBITMQ_PASS_I
          DB_USERNAME_A DB_PASSWORD_A REDIS_PASSWORD_A RABBITMQ_USER_A RABBITMQ_PASS_A)
for v in "${REQUIRED[@]}"; do
  if [[ -z "${!v}" ]]; then
    echo "[FAIL] $v 값이 비어있음. GitLab Variables 확인 필요" >&2
    exit 1
  fi
done

# ── 크로스 검증 (app-side == infra-side) ─────────────────
# 값이 다르면 실제 접속 실패하기 전에 early fail.
check_match() {
  local label="$1" a="$2" b="$3"
  if [[ "$a" != "$b" ]]; then
    echo "[MISMATCH] $label — app-side와 infra-side 값이 다름. GitLab Variables에서 정렬 필요" >&2
    exit 1
  fi
}
check_match "DB user (DB_USERNAME vs MYSQL_USER)"              "$DB_USERNAME_A"  "$MYSQL_USER_I"
check_match "DB password (DB_PASSWORD vs MYSQL_PASSWORD)"      "$DB_PASSWORD_A"  "$MYSQL_PASSWORD_I"
check_match "Redis password (BACKEND vs INFRA)"                "$REDIS_PASSWORD_A" "$REDIS_PASSWORD_I"
check_match "RabbitMQ user (RABBITMQ_USERNAME vs DEFAULT_USER)" "$RABBITMQ_USER_A" "$RABBITMQ_USER_I"
check_match "RabbitMQ password (RABBITMQ_PASSWORD vs DEFAULT_PASS)" "$RABBITMQ_PASS_A" "$RABBITMQ_PASS_I"
echo "[OK] app-side / infra-side 자격증명 정렬됨"

# ── 재시도 래퍼 (컨테이너 warm-up 여유) ─────────────────
with_retry() {
  local name="$1" max="${2:-12}" wait="${3:-5}"; shift 3 || true
  local i
  for i in $(seq 1 "$max"); do
    if "$@" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$wait"
  done
  echo "[FAIL] $name — $((max * wait))s 안에 접속 불가" >&2
  return 1
}

# ── MySQL: SELECT 1 ────────────────────────────────────
echo "── MySQL (${HOST_PREFIX}-mysql) ──"
mysql_check() {
  docker run --rm --network "$NETWORK" \
    -e MYSQL_PWD="$MYSQL_PASSWORD_I" \
    mysql:8.4 \
    mysql -h "${HOST_PREFIX}-mysql" -u "$MYSQL_USER_I" -D "$MYSQL_DATABASE_I" \
          --connect-timeout=5 -e "SELECT 1"
}
with_retry "MySQL" 12 5 mysql_check
echo "[OK] MySQL (${MYSQL_USER_I}@${HOST_PREFIX}-mysql/${MYSQL_DATABASE_I})"

# ── Redis: PING + AUTH ──────────────────────────────────
echo "── Redis (${HOST_PREFIX}-redis) ──"
redis_check() {
  local out
  out=$(docker run --rm --network "$NETWORK" \
    -e REDISCLI_AUTH="$REDIS_PASSWORD_I" \
    redis:7-alpine \
    redis-cli -h "${HOST_PREFIX}-redis" PING 2>&1)
  [[ "$out" == "PONG" ]]
}
with_retry "Redis" 10 3 redis_check
echo "[OK] Redis (${HOST_PREFIX}-redis)"

# ── RabbitMQ: management API /api/overview ──────────────
echo "── RabbitMQ (${HOST_PREFIX}-rabbitmq) ──"
rabbit_check() {
  docker run --rm --network "$NETWORK" \
    curlimages/curl:latest \
    -fsS --max-time 5 \
    -u "$RABBITMQ_USER_I:$RABBITMQ_PASS_I" \
    "http://${HOST_PREFIX}-rabbitmq:15672/api/overview"
}
with_retry "RabbitMQ" 12 5 rabbit_check
echo "[OK] RabbitMQ (${RABBITMQ_USER_I}@${HOST_PREFIX}-rabbitmq)"

echo "✓ infra health check passed (${ENV_NAME})"
