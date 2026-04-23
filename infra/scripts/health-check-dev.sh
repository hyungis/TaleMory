#!/usr/bin/env bash
# dev 환경 엔드포인트 헬스체크.
# - frontend/backend: nginx를 통해 /, /api/health 를 찌름.
# - ai-worker:        HTTP 엔드포인트가 없으므로 (1) 컨테이너 기동 상태 + (2) RabbitMQ
#                     management API consumer count 로 검증.
#
# Usage:
#   bash infra/scripts/health-check-dev.sh [backend|frontend|ai-worker|all]

set -euo pipefail

# ── ai-worker mgmt-API probe 용 helper ─────────────────────────
HOST_PREFIX="dev"
IMAGE_PREFIX="${IMAGE_PREFIX:-s210}"
NETWORK="${HOST_PREFIX}-${IMAGE_PREFIX}-infra-net"
INFRA_ENV="${ENV_DIR:-/tmp/env}/infra.dev.env"

get_env() { grep -E "^$1=" "$2" | head -1 | cut -d= -f2-; }
with_retry() {
  local name="$1" max="${2:-12}" wait="${3:-5}"; shift 3 || true
  local i
  for i in $(seq 1 "$max"); do
    if "$@" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$wait"
  done
  echo "[FAIL] $name — $((max * wait))s 안에 검증 실패" >&2
  return 1
}

SERVICE="${1:-all}"
FE_PORT="${DEV_FRONTEND_PORT:-3001}"
BASE="http://127.0.0.1:${FE_PORT}"

check() {
  local name="$1" url="$2" retries="${3:-12}" wait="${4:-5}"
  for i in $(seq 1 "$retries"); do
    if curl -fsS -m 3 "$url" >/dev/null 2>&1; then
      echo "[OK] $name  $url"
      return 0
    fi
    sleep "$wait"
  done
  echo "[FAIL] $name  $url (after $((retries * wait))s)" >&2
  return 1
}

case "$SERVICE" in
  frontend|nginx|all) check frontend "$BASE/" ;;
esac
case "$SERVICE" in
  backend|all)        check backend  "$BASE/api/health" ;;
esac
case "$SERVICE" in
  ai-worker|all)
    echo "── ai-worker ──"
    # (1) 컨테이너 상태
    running=$(docker ps --filter "name=ai-worker" --format '{{.Names}}' | wc -l | tr -d ' ')
    if [[ "${running:-0}" -lt 1 ]]; then
      echo "[FAIL] ai-worker: no running containers" >&2
      exit 1
    fi
    # (2) RabbitMQ broker-side consumer 등록 여부
    if [[ ! -f "$INFRA_ENV" ]]; then
      echo "[FAIL] $INFRA_ENV 없음 (infra 스택 env 파일 필요)" >&2
      exit 1
    fi
    RMQ_USER=$(get_env RABBITMQ_DEFAULT_USER "$INFRA_ENV")
    RMQ_PASS=$(get_env RABBITMQ_DEFAULT_PASS "$INFRA_ENV")
    if [[ -z "${RMQ_USER:-}" || -z "${RMQ_PASS:-}" ]]; then
      echo "[FAIL] RabbitMQ credentials 비어있음" >&2
      exit 1
    fi
    check_q() {
      local queue="$1"
      local count
      # 자격증명은 argv가 아닌 env var로 전달 — /proc/<pid>/cmdline / ps 노출 방지.
      # curl 실패 / no-match 시 count=0 fallback (pipefail-safe: `|| echo 0`은 전체 $() 대체).
      count=$(docker run --rm --network "$NETWORK" \
        -e RMQ_USER="$RMQ_USER" -e RMQ_PASS="$RMQ_PASS" \
        curlimages/curl:latest \
        sh -c 'curl -fsS --max-time 5 -u "$RMQ_USER:$RMQ_PASS" "$0"' \
        "http://${HOST_PREFIX}-rabbitmq:15672/api/queues/%2F/${queue}" 2>/dev/null \
        | grep -oE '"consumers":[0-9]+' | grep -oE '[0-9]+' || echo 0)
      [[ "${count:-0}" -ge 1 ]]
    }
    with_retry "storyboard.generate.request consumers>=1"   12 5 check_q storyboard.generate.request
    with_retry "storyboard.regenerate.request consumers>=1" 12 5 check_q storyboard.regenerate.request
    echo "[OK] ai-worker ($running containers, both queues have consumers)"
    ;;
esac
