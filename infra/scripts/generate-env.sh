#!/usr/bin/env bash
# GitLab Variables → /tmp/env/app.<target>.env + /tmp/env/infra.<target>.env
#
# Naming convention:
#   ENV_BASE_K=V                  → app.<target>.env AND infra.<target>.env : K=V
#   ENV_<TARGET>_BACKEND_K=V      → app.<target>.env : K=V
#   ENV_<TARGET>_FRONTEND_K=V     → app.<target>.env : K=V
#   ENV_<TARGET>_AI_K=V           → app.<target>.env : K=V
#   ENV_<TARGET>_INFRA_K=V        → infra.<target>.env : K=V
#
# Usage:
#   bash infra/scripts/generate-env.sh dev
#   bash infra/scripts/generate-env.sh master

set -euo pipefail

TARGET="${1:?usage: $0 <dev|master>}"
OUT_DIR="${OUT_DIR:-/tmp/env}"
mkdir -p "$OUT_DIR"

target_upper=$(echo "$TARGET" | tr '[:lower:]' '[:upper:]')

append_prefix_match() {
  local prefix="$1"
  local out="$2"
  env | awk -v p="$prefix" 'index($0, p) == 1 { sub("^" p, ""); print }' >> "$out"
}

APP_OUT="$OUT_DIR/app.${TARGET}.env"
INFRA_OUT="$OUT_DIR/infra.${TARGET}.env"
: > "$APP_OUT"
: > "$INFRA_OUT"

# 공통 — 양쪽에 들어감
append_prefix_match "ENV_BASE_" "$APP_OUT"
append_prefix_match "ENV_BASE_" "$INFRA_OUT"

# 앱 서비스 변수 — 전부 app.<target>.env 하나로 합침
for svc in BACKEND FRONTEND AI; do
  append_prefix_match "ENV_${target_upper}_${svc}_" "$APP_OUT"
done

# 인프라(MySQL/Redis/RabbitMQ) 변수
append_prefix_match "ENV_${target_upper}_INFRA_" "$INFRA_OUT"

echo "generated: $APP_OUT ($(wc -l < "$APP_OUT") lines)"
echo "generated: $INFRA_OUT ($(wc -l < "$INFRA_OUT") lines)"
