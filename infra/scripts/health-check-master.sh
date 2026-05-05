#!/usr/bin/env bash
# master(운영) 환경 엔드포인트 헬스체크.
# - frontend / backend       : HTTPS 공인 도메인으로 /, /api/health HTTP 프로브
# - ai-worker                : (1) 컨테이너 기동 + (2) RabbitMQ Mgmt API 의 비즈니스 큐 consumer >= 1
# - ai-tts-* (신규 워커들)   : (1) 컨테이너 기동 + (1.5) restart loop 검출 + (2) Python 워커 코드의
#                              HEALTHCHECK_QUEUE 상수와 동기화된 더미 큐의 consumer >= 1
#                              → 비즈니스 큐 / env var 변경에 헬스체크가 영향받지 않음.
#
# Usage:
#   bash infra/scripts/health-check-master.sh                     # all
#   bash infra/scripts/health-check-master.sh ai-tts-story-worker
#   bash infra/scripts/health-check-master.sh backend|frontend|ai-worker

set -euo pipefail

# ── env / network 상수 ─────────────────────────────────────────
HOST_PREFIX="prod"
IMAGE_PREFIX="${IMAGE_PREFIX:-s210}"
NETWORK="${HOST_PREFIX}-${IMAGE_PREFIX}-infra-net"
INFRA_ENV="${ENV_DIR:-/tmp/env}/infra.master.env"
APP_ENV="${ENV_DIR:-/tmp/env}/app.master.env"

# ── 공용 helpers ───────────────────────────────────────────────
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

load_rmq_creds() {
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
}

check_q() {
  local queue="$1"
  local count
  # 자격증명은 argv 가 아닌 env var 로 전달 — /proc/<pid>/cmdline / ps 노출 방지.
  count=$(docker run --rm --network "$NETWORK" \
    -e RMQ_USER="$RMQ_USER" -e RMQ_PASS="$RMQ_PASS" \
    curlimages/curl:latest \
    sh -c 'curl -fsS --max-time 5 -u "$RMQ_USER:$RMQ_PASS" "$0"' \
    "http://${HOST_PREFIX}-rabbitmq:15672/api/queues/%2F/${queue}" 2>/dev/null \
    | grep -oE '"consumers":[0-9]+' | grep -oE '[0-9]+' || echo 0)
  [[ "${count:-0}" -ge 1 ]]
}

check_worker_running() {
  local svc="$1"
  local running
  running=$(docker ps --filter "name=${svc}" --format '{{.Names}}' | wc -l | tr -d ' ')
  if [[ "${running:-0}" -lt 1 ]]; then
    echo "[FAIL] ${svc}: no running containers" >&2
    return 1
  fi
  for c in $(docker ps --filter "name=${svc}" --format '{{.Names}}'); do
    rc=$(docker inspect --format '{{.RestartCount}}' "$c" 2>/dev/null || echo 0)
    if [[ "${rc:-0}" -gt 2 ]]; then
      echo "[FAIL] ${c}: restart loop (RestartCount=${rc})" >&2
      docker logs --tail 30 "$c" >&2 || true
      return 1
    fi
  done
  echo "[OK] ${svc} (${running} containers, no restart loop)"
}

# ── HTTP probe ─────────────────────────────────────────────────
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

# ── ai-worker (기존 그대로 — 비즈니스 큐 consumer probe) ───────
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
    load_rmq_creds
    # 큐 이름은 하드코딩 금지 — app.master.env 에서 읽어서 코드 변경 없이 큐 이름 rename 대응.
    if [[ ! -f "$APP_ENV" ]]; then
      echo "[FAIL] $APP_ENV 없음 (app 스택 env 파일 필요)" >&2
      exit 1
    fi
    GEN_Q=$(get_env RABBITMQ_GENERATE_QUEUE "$APP_ENV")
    REGEN_Q=$(get_env RABBITMQ_REGENERATE_QUEUE "$APP_ENV")
    if [[ -z "${GEN_Q:-}" ]]; then
      echo "[FAIL] RABBITMQ_GENERATE_QUEUE 비어있음 (GitLab Variable 미등록?)" >&2
      exit 1
    fi
    with_retry "${GEN_Q} consumers>=1" 12 5 check_q "$GEN_Q"
    if [[ -n "${REGEN_Q:-}" && "$REGEN_Q" != "$GEN_Q" ]]; then
      with_retry "${REGEN_Q} consumers>=1" 12 5 check_q "$REGEN_Q"
    fi
    echo "[OK] ai-worker ($running containers, queue(s) have consumers)"
    ;;
esac

# ── ai-tts-story-worker (신규) ─────────────────────────────────
# 큐 이름은 app/ai/worker_tts_story.py 의 HEALTHCHECK_QUEUE 상수와 동기화.
case "$SERVICE" in
  ai-tts-story-worker|all)
    echo "── ai-tts-story-worker ──"
    check_worker_running "ai-tts-story-worker"
    load_rmq_creds
    with_retry "ai.healthcheck.tts-story.queue consumers>=1" 12 5 \
      check_q "ai.healthcheck.tts-story.queue"
    echo "[OK] ai-tts-story-worker (healthcheck queue has consumer)"
    ;;
esac

# ── ai-tts-preview-worker (신규) ───────────────────────────────
# 큐 이름은 app/ai/worker_tts_preview.py 의 HEALTHCHECK_QUEUE 상수와 동기화.
case "$SERVICE" in
  ai-tts-preview-worker|all)
    echo "── ai-tts-preview-worker ──"
    check_worker_running "ai-tts-preview-worker"
    load_rmq_creds
    with_retry "ai.healthcheck.tts-preview.queue consumers>=1" 12 5 \
      check_q "ai.healthcheck.tts-preview.queue"
    echo "[OK] ai-tts-preview-worker (healthcheck queue has consumer)"
    ;;
esac
