#!/usr/bin/env bash
# 배포 성공 + 알림 발송 이후 로컬 docker daemon의 오래된 이미지 정리.
# .post stage에서 `when: on_success` + `needs: [notify_success]`로 호출됨.
# 실패 pipeline에서는 실행되지 않아 디버깅용 이미지/상태가 보존됨.
#
# 정리 대상:
#   - dangling 이미지 (태그 잃은 고아)
#   - s210-<service>:<tag> 중 서비스별 오래된 태그 (최근 KEEP_IMAGES 개수만 유지)
#
# 안전장치:
#   - 실행 중인 컨테이너가 쓰는 이미지는 docker가 자동 보호 (rmi 실패하면 skip)
#   - s210-* prefix로 필터링 — public 이미지(mysql, redis, curlimages/curl)는 건드리지 않음
#     → healthcheck가 쓰는 pull 캐시 유지, Docker Hub 재pull 방지
#
# Optional env:
#   KEEP_IMAGES=5   서비스별 유지할 최근 태그 개수 (default: 5)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

KEEP="${KEEP_IMAGES:-5}"
SERVICES=("${IMAGE_PREFIX}-frontend" "${IMAGE_PREFIX}-backend" "${IMAGE_PREFIX}-ai")

df_docker() {
  df -h /var/lib/docker 2>/dev/null | awk 'NR==2 {print $3"/"$2" ("$5")"}' || echo "n/a"
}

echo "[cleanup] before: $(df_docker)"

# 1. dangling 이미지 정리 (multi-stage build 중간 레이어, 교체된 태그 등)
docker image prune -f >/dev/null 2>&1 || true

# 2. 서비스별 최근 KEEP개 태그만 유지
for svc in "${SERVICES[@]}"; do
  docker images --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' \
    | awk -v s="$svc" '$1 ~ "^"s":" { print }' \
    | sort -k2 -r \
    | tail -n +$((KEEP + 1)) \
    | awk '{print $1}' \
    | xargs -r docker rmi 2>/dev/null || true
done

echo "[cleanup] after:  $(df_docker)"
echo "[cleanup] kept $KEEP latest tags per ${IMAGE_PREFIX}-* service"
