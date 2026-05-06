#!/usr/bin/env bash
# dev 환경 app 스택 배포. 인자 없으면 compose 정의 전체, 있으면 해당 서비스만.
# 실패 시 자동 복구는 하지 않음 — pipeline fail 로 표면화.
# 복구 경로: git revert → push → 새 pipeline, 또는 GitLab 변수 override 로 이전 SHA 재실행.
#
# 서비스명은 docker-compose.app-dev.yml 의 services 키와 1:1 매칭. compose 에 새 서비스를
# 추가하면 스크립트 수정 없이 `all` 에 자동 포함된다.
#
# Usage:
#   bash infra/scripts/deploy-dev.sh                       # 전체
#   bash infra/scripts/deploy-dev.sh backend               # backend 만
#   bash infra/scripts/deploy-dev.sh frontend              # nginx 별칭
#   bash infra/scripts/deploy-dev.sh ai                    # ai-* 모든 워커
#   bash infra/scripts/deploy-dev.sh ai-tts-story-worker   # 임의의 단일 서비스

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

SERVICE="${1:-all}"
TAG="${APP_IMAGE_TAG:-${CI_COMMIT_SHORT_SHA:?APP_IMAGE_TAG or CI_COMMIT_SHORT_SHA required}}"
ENV_NAME="dev"

COMPOSE_FILE="infra/compose/docker-compose.app-${ENV_NAME}.yml"
COMPOSE_PROJECT="${IMAGE_PREFIX}-app-${ENV_NAME}"
ENV_FILE="/tmp/env/app.${ENV_NAME}.env"

require_file "$COMPOSE_FILE"
require_file "$ENV_FILE"

export APP_IMAGE_TAG="$TAG"
export COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT"

compose_cmd() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" "$@"
}

# compose 가 인식하는 서비스 목록을 single source of truth 로 사용.
# 새 서비스를 compose 에 추가해도 이 스크립트는 그대로 — 자동 enumerate.
ALL_SERVICES=$(compose_cmd config --services)

resolve_services() {
  case "$SERVICE" in
    all)
      echo "$ALL_SERVICES"
      ;;
    frontend)
      # UX 별칭 — 사용자가 nginx 라는 compose service name 을 외울 필요 없게.
      echo "nginx"
      ;;
    ai)
      # ai-* prefix 모든 서비스 (ai-worker, ai-tts-*-worker 등). compose 에 새 ai-* 추가 시 자동 포함.
      # CI 의 deploy_dev_ai job 이 이 별칭으로 호출.
      echo "$ALL_SERVICES" | grep -E '^ai-' || {
        echo "no ai-* services found in compose" >&2
        exit 1
      }
      ;;
    *)
      if echo "$ALL_SERVICES" | grep -qx "$SERVICE"; then
        echo "$SERVICE"
      else
        echo "unknown service: $SERVICE" >&2
        echo "available: $(echo "$ALL_SERVICES" | tr '\n' ' ')" >&2
        exit 1
      fi
      ;;
  esac
}

# selective recreate — daemon 에 새 SHA 이미지가 있는 서비스만 up.
# 변경 없는 서비스는 build_<svc> 가 changes 필터로 skip → 그 SHA 의 이미지가 daemon 에
# 존재하지 않음 → 컨테이너를 건드리지 않고 이전 SHA 이미지로 그대로 유지.
# --no-deps: nginx 의 depends_on backend 같은 의존 추가 끌어오기 방지 — 없는 이미지를
# pull 시도하다 실패하는 케이스 차단 (이번 PR 의 핵심 수정).
COMPOSE_CONFIG_JSON=$(compose_cmd config --format json)
SERVICES_TO_UP=()
while IFS= read -r svc; do
  [[ -z "$svc" ]] && continue
  IMG=$(echo "$COMPOSE_CONFIG_JSON" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['services'].get('$svc',{}).get('image',''))")
  if [[ -n "$IMG" ]] && docker image inspect "$IMG" >/dev/null 2>&1; then
    SERVICES_TO_UP+=("$svc")
  else
    echo "[SKIP] ${svc}: image '${IMG}' not in daemon (build skipped or first deploy)"
  fi
done < <(resolve_services)

if [[ ${#SERVICES_TO_UP[@]} -eq 0 ]]; then
  echo "no services with built image — nothing to deploy"
  exit 0
fi

echo "[INFO] recreating: ${SERVICES_TO_UP[*]}"
compose_cmd up -d --no-build --no-deps "${SERVICES_TO_UP[@]}"

# backend 만 recreate 됐을 때 nginx 가 직전 backend 컨테이너의 stale IP 를 잡고 있어
# /api/* upstream routing 실패 (nginx worker 시작 시 한 번만 DNS resolve). reload 로
# worker 재시작 → 새 backend IP 재해석. nginx 자체가 recreate 된 경우는 새 worker 가
# fresh resolve 하니 reload 불필요.
# compose ps -q 로 컨테이너 ID 직접 얻어 HOST_PREFIX/container_name 매핑 의존성 제거.
if [[ " ${SERVICES_TO_UP[*]} " == *" backend "* ]] \
   && [[ " ${SERVICES_TO_UP[*]} " != *" nginx "* ]]; then
  NGINX_CID=$(compose_cmd ps -q nginx 2>/dev/null || true)
  if [[ -n "$NGINX_CID" ]]; then
    echo "[INFO] backend recreated without nginx → reload nginx (refresh upstream DNS)"
    docker exec "$NGINX_CID" nginx -s reload || true
  fi
fi

bash "$SCRIPT_DIR/health-check-${ENV_NAME}.sh" "$SERVICE"

# ── Legacy uvicorn AI 컨테이너 정리 ──
# 옛 deploy/app/docker-compose.yml 의 잔재 (dev-ai). BE 가 보이스 미리듣기를 RabbitMQ
# 로 마이그레이션 (9702e30) 한 후 HTTP→AI 호출이 0 건 — 더 이상 필요 없다.
# 새 compose 는 모든 AI 서비스를 worker.py / worker_tts_*.py 로 override 하므로 어떤
# 시나리오에서도 uvicorn HTTP 서버를 띄우지 않는다. legacy 컨테이너가 살아있으면
# 자원/포트 점유 + 운영 혼동이 누적되므로 CI/CD 가 매번 정리해 잔재가 쌓이지 않게 한다.
# health-check 통과 후 cleanup 하여 새 시스템 정상 확인 후에만 legacy 를 제거한다.
# 컨테이너가 없으면 silent 통과 (idempotent).
for legacy in dev-ai; do
  if docker ps -a --format '{{.Names}}' | grep -qx "${legacy}"; then
    echo "[CLEANUP] removing legacy uvicorn container: ${legacy}"
    docker stop "${legacy}" >/dev/null 2>&1 || true
    docker rm   "${legacy}" >/dev/null 2>&1 || true
  fi
done

echo "deploy-${ENV_NAME} OK ($SERVICE = $TAG)"
