# infra/scripts

GitLab CI(`.gitlab-ci.yml`)에서 호출되는 shell script와, 일부는 배포 서버에서 수동 실행되는 운영 script. 모두 `bash` + `set -euo pipefail` 전제.

## 스크립트 목록

| Script | 용도 | 호출 위치 |
|---|---|---|
| `common.sh` | 공유 함수(image ref, 공통 globals) | 다른 스크립트에서 `source` |
| `generate-env.sh <target>` | GitLab Variables → `/tmp/env/app.<target>.env`, `infra.<target>.env` | CI: `generate_env` stage |
| `build-frontend.sh` | frontend(React + nginx) 이미지 빌드 & push | CI: `build_frontend` stage |
| `build-backend.sh` | backend 이미지 빌드 & push | CI: `build_backend` stage |
| `build-ai.sh` | ai 이미지 빌드 & push | CI: `build_ai` stage |
| `deploy-dev.sh [service]` | dev 배포 (자동 rollback 없음 — 실패는 pipeline fail로 표면화) | CI: `deploy_dev` stage |
| `deploy-master.sh [service]` | master 배포 (자동 rollback 없음) | CI: `deploy_master` stage (manual) |
| `deploy-infra-dev.sh` | dev MySQL/Redis/RabbitMQ compose up | 수동 (변경 있을 때만) |
| `deploy-infra-master.sh` | master MySQL/Redis/RabbitMQ compose up | 수동 |
| `health-check-dev.sh [service]` | nginx 경유로 `/`, `/api/health`, `/ai/health` polling | deploy-dev.sh 내부 |
| `health-check-master.sh [service]` | 위와 동일, master 포트 | deploy-master.sh 내부 |
| `notify.sh <status> <job>` | Discord embed 알림 | CI: `.post` stage |

`[service]` 인자는 `backend`, `frontend`, `ai`, `all`(기본) 중 하나. `frontend`는 compose 서비스명 `nginx`에 매핑.

## Required globals (common.sh 기본값)

| Var | Default | Origin |
|---|---|---|
| `PROJECT_NAME` | `s210` | common.sh |
| `ROOT_DIR` | `/srv/s210` | common.sh |
| `REGISTRY` | `$CI_REGISTRY_IMAGE` | GitLab 자동 주입 |
| `APP_IMAGE_TAG` | `$CI_COMMIT_SHORT_SHA` | `.gitlab-ci.yml`의 `variables:`에서 설정 |

## 전형적 배포 흐름

```
generate-env.sh dev
build-frontend.sh              (build_* 3개 병렬, 각 job이 push까지)
build-backend.sh
build-ai.sh
deploy-dev.sh                  (pull + up + health check; 실패 시 pipeline fail)
```

## 장애 복구 경로

자동 rollback 로직은 없음. 실패 시:

1. 즉시 복구 필요하면 GitLab pipeline UI에서 **변수 `APP_IMAGE_TAG=<이전_SHA>` override 후 재실행** → 이전 이미지로 재배포.
2. 근본 수정 후 복구: `git revert <bad_sha>` → push → 정방향 pipeline.

registry에 이전 이미지가 남아 있어야 1번이 동작. cleanup policy는 "최근 N개 유지" 식으로 여유를 둘 것.

## Runner/서버 필수 패키지

- `docker`, `docker compose` v2
- `curl`
- `jq` (notify.sh용. 한 번만: `sudo apt install -y jq`)

## 규약

- deploy 스크립트는 `--no-build` 전제 — 이미지는 registry에서 pull. build는 별도 stage
- 자동 rollback / state 파일 없음. 실패는 pipeline fail로 표면화
- 모든 script 재실행(idempotent) 안전
