#!/usr/bin/env bash
# GitLab Variables → /tmp/env/app.<target>.env + /tmp/env/infra.<target>.env
#
# 두 가지 소스를 합쳐서 단일 env 파일로 출력 (하이브리드):
#
#   ① File Variable                                                          (1단계 — base)
#      - GitLab Type=File 로 등록한 변수. runner 가 임시 파일 경로로 주입.
#      - ENV_<TARGET>_APP_ENV_FILE   →  /tmp/env/app.<target>.env  로 복사
#      - ENV_<TARGET>_INFRA_ENV_FILE →  /tmp/env/infra.<target>.env 로 복사
#      - 비밀이 아닌 일반 설정값 묶음 (DB_URL, FRONTEND_PORT 등 수십 개).
#      - 키 접미사 `_ENV_FILE` 은 하이브리드 스킴 전용 — 일반 `_FILE` 변수
#        (TLS_CERT_FILE, CONFIG_FILE 등) 와 명확히 구분.
#
#   ② Prefix Variables                                                       (2단계 — append)
#      - GitLab Type=Variable + Masked 로 등록한 개별 변수. (PASSWORD/SECRET/KEY 류)
#      - ENV_BASE_K=V                  → 양쪽 파일 모두에 K=V 로 append
#      - ENV_<TARGET>_APP_K=V          → app.<target>.env 에 append
#      - ENV_<TARGET>_INFRA_K=V        → infra.<target>.env 에 append
#
# 동일 키가 ① 과 ② 양쪽에 존재하면 **나중에 append 된 ②(개별 변수) 값이 이김** —
# Docker Compose `env_file:` 의 표준 동작 (last KEY=VALUE wins).
# → 비민감값을 File 에 평문으로 두고 민감값만 개별 Masked 변수로 두면
#   `cp + append` 만으로 자동 합쳐짐. 마이그레이션 중간 상태에서도 안전.
#
# Backward-compat: File 변수가 미설정이거나 파일이 없으면 조용히 스킵 →
# 기존 prefix-only 흐름과 동일하게 동작.
#
# Usage:
#   bash infra/scripts/generate-env.sh dev
#   bash infra/scripts/generate-env.sh master

set -euo pipefail

TARGET="${1:?usage: $0 <dev|master>}"
OUT_DIR="${OUT_DIR:-/tmp/env}"
mkdir -p "$OUT_DIR"

target_upper=$(echo "$TARGET" | tr '[:lower:]' '[:upper:]')

APP_OUT="$OUT_DIR/app.${TARGET}.env"
INFRA_OUT="$OUT_DIR/infra.${TARGET}.env"

# ── ① File Variable 복사 (있을 때만) ────────────────────────────────────
# GitLab File 변수는 runner 환경에 `KEY=/path/to/tmpfile` 형태로 주입된다.
# 변수 자체가 미설정이거나 파일이 사라졌으면 조용히 스킵 → 기존 prefix-only 흐름과 동일.
APP_ENV_FILE_VAR="ENV_${target_upper}_APP_ENV_FILE"
INFRA_ENV_FILE_VAR="ENV_${target_upper}_INFRA_ENV_FILE"

if [[ -n "${!APP_ENV_FILE_VAR:-}" && -f "${!APP_ENV_FILE_VAR}" ]]; then
  cp "${!APP_ENV_FILE_VAR}" "$APP_OUT"
  echo "copied ($APP_ENV_FILE_VAR) → $APP_OUT"
else
  : > "$APP_OUT"
fi

if [[ -n "${!INFRA_ENV_FILE_VAR:-}" && -f "${!INFRA_ENV_FILE_VAR}" ]]; then
  cp "${!INFRA_ENV_FILE_VAR}" "$INFRA_OUT"
  echo "copied ($INFRA_ENV_FILE_VAR) → $INFRA_OUT"
else
  : > "$INFRA_OUT"
fi

# ── ② Prefix-based 개별 변수 append ──────────────────────────────────────
# 동일 키가 ①·② 양쪽에 있으면 나중에 append 된 ② 값이 최종 사용됨.
# 하이브리드 File 변수(`ENV_<TARGET>_<SCOPE>_ENV_FILE`) 자체가 prefix 매칭에
# 걸리는 것을 막기 위해 제외 (재귀 방지). 정확히 `ENV_FILE` 키만 차단하므로
# 일반 `_FILE` 접미사 변수(TLS_CERT_FILE, CONFIG_FILE 등) 는 영향 없음.
append_prefix_match() {
  local prefix="$1"
  local out="$2"
  env | awk -v p="$prefix" '
    index($0, p) == 1 {
      sub("^" p, "")
      split($0, kv, "=")
      if (kv[1] == "ENV_FILE") next
      print
    }
  ' >> "$out"
}

# 공통 — 양쪽에 들어감
append_prefix_match "ENV_BASE_" "$APP_OUT"
append_prefix_match "ENV_BASE_" "$INFRA_OUT"

# 앱 서비스 변수 (backend + frontend + ai 통합) — app.<target>.env 하나로 합침
append_prefix_match "ENV_${target_upper}_APP_" "$APP_OUT"

# 인프라(MySQL/Redis/RabbitMQ) 변수
append_prefix_match "ENV_${target_upper}_INFRA_" "$INFRA_OUT"

echo "generated: $APP_OUT ($(wc -l < "$APP_OUT") lines)"
echo "generated: $INFRA_OUT ($(wc -l < "$INFRA_OUT") lines)"
