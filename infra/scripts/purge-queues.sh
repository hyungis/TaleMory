#!/usr/bin/env bash
# RabbitMQ 큐 purge — CI의 수동 트리거 job (`purge_queues_dev`)에서 실행.
# 큐 스키마 변경 / 스테일 메시지 정리 / 개발 환경 리셋 시 사용.
#
# 설계:
#   - dev 전용. master(운영)에서는 절대 실행 금지 — 실 사용자 요청이 삭제됨.
#   - 큐 이름은 /tmp/env/app.<env>.env 의 RABBITMQ_*_QUEUE 에서 읽음 (하드코딩 금지).
#     → 향후 큐 이름이 바뀌어도 env 변경만으로 따라감.
#   - `rabbitmqctl purge_queue`는 큐의 메시지만 비우고, 큐/바인딩/consumer 는 유지.
#
# Usage:
#   bash infra/scripts/purge-queues.sh dev

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ENV_NAME="${1:?usage: $0 <dev>}"
case "$ENV_NAME" in
  dev) HOST_PREFIX="dev" ;;
  *) echo "unsupported env: $ENV_NAME (dev 전용 — master는 실 사용자 요청 삭제 위험)" >&2; exit 1 ;;
esac

APP_ENV="${ENV_DIR:-/tmp/env}/app.${ENV_NAME}.env"
require_file "$APP_ENV"

get_env() { grep -E "^$1=" "$2" | head -1 | cut -d= -f2-; }
GEN_QUEUE=$(get_env RABBITMQ_GENERATE_QUEUE "$APP_ENV")
REGEN_QUEUE=$(get_env RABBITMQ_REGENERATE_QUEUE "$APP_ENV")

if [[ -z "$GEN_QUEUE" && -z "$REGEN_QUEUE" ]]; then
  echo "[FAIL] RABBITMQ_GENERATE_QUEUE / RABBITMQ_REGENERATE_QUEUE 둘 다 비어있음 ($APP_ENV 확인)" >&2
  exit 1
fi

RMQ="${HOST_PREFIX}-rabbitmq"

for q in "$GEN_QUEUE" "$REGEN_QUEUE"; do
  [[ -n "$q" ]] || continue
  echo "── purge $q on $RMQ ──"
  before=$(docker exec "$RMQ" rabbitmqctl list_queues name messages --no-table-headers 2>/dev/null \
    | awk -v q="$q" '$1==q {print $2}')
  docker exec "$RMQ" rabbitmqctl purge_queue "$q"
  echo "[OK] purged $q (was ${before:-0} messages)"
done

echo "✓ queue purge complete (${ENV_NAME})"
