#!/usr/bin/env bash
# master(운영) 환경 엔드포인트 헬스체크.
#
# Usage:
#   bash infra/scripts/health-check-master.sh [backend|frontend|ai|all]

set -euo pipefail

SERVICE="${1:-all}"
# HTTPS 적용 이후 공인 도메인으로 체크. 서버 자기 자신으로 hairpin NAT 되는지
# AWS 보안그룹/SSAFY 설정에 따라 다름 — 실패 시 MASTER_DOMAIN 대신 127.0.0.1 로 교체
# 하고 --resolve 옵션으로 SNI 를 맞추면 됨.
DOMAIN="${MASTER_DOMAIN:-k14s210.p.ssafy.io}"
BASE="https://${DOMAIN}"

check() {
  local name="$1" url="$2" retries="${3:-12}" wait="${4:-5}"
  # --resolve: DNS 를 거치지 않고 localhost 로 접속하되 SNI/Host 는 공인 도메인 유지.
  # 서버가 자기 자신 도메인을 hairpin NAT 로 해석 못 해도 인증서 검증은 통과.
  local resolve_opts=(--resolve "${DOMAIN}:443:127.0.0.1" --resolve "${DOMAIN}:80:127.0.0.1")
  for i in $(seq 1 "$retries"); do
    if curl -fsS -m 3 "${resolve_opts[@]}" "$url" >/dev/null 2>&1; then
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
