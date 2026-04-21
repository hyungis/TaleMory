#!/usr/bin/env bash
# dev 환경 엔드포인트 헬스체크. nginx를 통해 /, /api/health, /ai/health를 찌름.
#
# Usage:
#   bash infra/scripts/health-check-dev.sh [backend|frontend|ai|all]

set -euo pipefail

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
  ai|all)             check ai       "$BASE/ai/health" ;;
esac
