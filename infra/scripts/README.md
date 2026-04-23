# infra/scripts

GitLab CI(`.gitlab-ci.yml`)에서 호출되는 shell script와, 일부는 배포 서버에서 수동 실행되는 운영 script. 모두 `bash` + `set -euo pipefail` 전제.

## 스크립트 목록

| Script | 용도 | 호출 위치 |
|---|---|---|
| `common.sh` | 공유 함수(image ref, 공통 globals) | 다른 스크립트에서 `source` |
| `generate-env.sh <target>` | GitLab Variables → `/tmp/env/app.<target>.env`, `infra.<target>.env` | CI: `generate_env` stage |
| `build-frontend.sh` | frontend(React + nginx) 로컬 이미지 빌드 | CI: `build_frontend` stage |
| `build-backend.sh` | backend 로컬 이미지 빌드 | CI: `build_backend` stage |
| `build-ai.sh` | ai 로컬 이미지 빌드 | CI: `build_ai` stage |
| `deploy-dev.sh [service]` | dev 배포 (자동 rollback 없음 — 실패는 pipeline fail로 표면화) | CI: `deploy_dev` stage |
| `deploy-master.sh [service]` | master 배포 (자동 rollback 없음) | CI: `deploy_master` stage (manual) |
| `deploy-infra-dev.sh` | dev MySQL/Redis/RabbitMQ compose up | 수동 (변경 있을 때만) |
| `deploy-infra-master.sh` | master MySQL/Redis/RabbitMQ compose up | 수동 |
| `health-check-dev.sh [service]` | nginx 경유로 `/`, `/api/health`, `/ai/health` polling | deploy-dev.sh 내부 |
| `health-check-master.sh [service]` | 위와 동일, master 포트 | deploy-master.sh 내부 |
| `health-check-infra.sh <env>` | mysql/redis/rabbitmq 실제 접속 + app↔infra creds 정렬 검증 | CI: `verify_infra_<env>` / `deploy_infra_<env>` |
| `notify.sh <status> <job>` | Discord embed 알림 | CI: `.post` stage |
| `cleanup-images.sh` | s210-* 서비스별 최근 N개 태그만 유지 + dangling 정리 | CI: `.post` stage, notify 이후 성공 시만 |

`[service]` 인자는 `backend`, `frontend`, `ai`, `all`(기본) 중 하나. `frontend`는 compose 서비스명 `nginx`에 매핑.

## Required globals (common.sh 기본값)

| Var | Default | Origin |
|---|---|---|
| `IMAGE_PREFIX` | `s210` | common.sh |
| `ROOT_DIR` | `/srv/s210` | common.sh |
| `APP_IMAGE_TAG` | `$CI_COMMIT_SHORT_SHA` | `.gitlab-ci.yml`의 `variables:`에서 설정 |

이미지 태그 형식은 `s210-<service>:<tag>` — 배포 서버 docker daemon 안에서만 유효.

## 전형적 배포 흐름

```
generate-env.sh dev
build-frontend.sh              (build_* 3개 병렬, 로컬 daemon에 태그만 생성)
build-backend.sh
build-ai.sh
deploy-dev.sh                  (로컬 이미지로 compose up + health check; 실패 시 pipeline fail)
```

> SSAFY GitLab은 Container Registry가 비활성이라 push/pull 없이 **project runner(=배포 서버)** 의 docker daemon 안에서 빌드 → 바로 사용. 추후 Harbor/GHCR 등 registry 도입 시 `common.sh`의 `image_ref`에 prefix 추가 + `build-*.sh`에 `docker push`, `deploy-*.sh`에 `docker pull`만 넣으면 됨.

## 장애 복구 경로

자동 rollback 로직은 없음. 실패 시:

1. 즉시 복구: GitLab pipeline UI에서 **변수 `APP_IMAGE_TAG=<이전_SHA>` override 후 `deploy_*` job만 재실행**. 배포 서버 docker daemon에 해당 SHA 이미지가 남아 있어야 함.
2. 근본 수정 후 복구: `git revert <bad_sha>` → push → 정방향 pipeline.

## 로컬 이미지 관리

Registry를 안 쓰므로 이미지가 배포 서버 docker daemon에 그대로 쌓임. 주기적 정리 필요:

```bash
# 72시간 지난 dangling 이미지 정리
docker image prune -f --filter "until=72h"

# 최근 20개만 남기고 s210-* 이미지 삭제 (CAUTION: 구버전 롤백 불가해짐)
docker image ls --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' \
  | grep '^s210-' | sort -k2 -r | tail -n +21 \
  | awk '{print $1}' | xargs -r docker rmi
```

운영 서버에 cron으로 등록해두는 게 안전.

## Runner/서버 필수 패키지

- `docker`, `docker compose` v2
- `curl`
- `jq` (notify.sh용. 한 번만: `sudo apt install -y jq`)

## 규약

- deploy 스크립트는 `--no-build` 전제 — build 단계가 이미 끝나 있어야 함
- 자동 rollback / state 파일 없음. 실패는 pipeline fail로 표면화
- 모든 script 재실행(idempotent) 안전
