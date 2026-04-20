# infra/scripts

GitLab CI(`.gitlab-ci.yml`)에서 호출되는 shell script와, 일부는 배포 서버에서 수동 실행되는 운영 script. 모두 `bash` + `set -euo pipefail` 전제.

## 스크립트 목록

| Script | 용도 | 호출 위치 |
|---|---|---|
| `common.sh` | 공유 함수(state 파일, image ref, 로그 dump) | 다른 스크립트에서 `source` |
| `generate-env.sh <target>` | GitLab Variables → `/tmp/env/app.<target>.env`, `infra.<target>.env` | CI: `generate_env` stage |
| `build-frontend.sh` | frontend(React + nginx) 이미지 빌드 & push | CI: `build_frontend` stage |
| `build-backend.sh` | backend 이미지 빌드 & push | CI: `build_backend` stage |
| `build-ai.sh` | ai 이미지 빌드 & push | CI: `build_ai` stage |
| `deploy-dev.sh [service]` | dev 배포 + 실패 시 자동 rollback | CI: `deploy_dev` stage |
| `deploy-master.sh [service]` | master 배포 + 실패 시 자동 rollback | CI: `deploy_master` stage (manual) |
| `deploy-infra-dev.sh` | dev MySQL/Redis/RabbitMQ compose up | 수동 (변경 있을 때만) |
| `deploy-infra-master.sh` | master MySQL/Redis/RabbitMQ compose up | 수동 |
| `health-check-dev.sh [service]` | nginx 경유로 `/`, `/api/health`, `/ai/health` polling | deploy-dev.sh 내부 |
| `health-check-master.sh [service]` | 위와 동일, master 포트 | deploy-master.sh 내부 |
| `rollback-dev.sh [service]` | `last_ok_tag`로 재배포(state 유지) | CI: manual job |
| `rollback-master.sh [service]` | master용 rollback | CI: manual job |
| `notify.sh <status> <job>` | Discord embed 알림 | CI: `.post` stage |

`[service]` 인자는 `backend`, `frontend`, `ai`, `all`(기본) 중 하나. `frontend`는 compose 서비스명 `nginx`에 매핑.

## Required globals (common.sh 기본값)

| Var | Default | Origin |
|---|---|---|
| `PROJECT_NAME` | `s210` | common.sh |
| `ROOT_DIR` | `/srv/s210` | common.sh |
| `REGISTRY` | `$CI_REGISTRY_IMAGE` | GitLab 자동 주입 |
| `APP_IMAGE_TAG` | `$CI_COMMIT_SHORT_SHA` | `.gitlab-ci.yml`의 `variables:`에서 설정 |

## State 파일 (배포 서버)

```
/srv/s210/<env>/state/
  last_ok_tag_<service>        ← 마지막으로 health check 통과한 태그
  previous_ok_tag_<service>    ← 그 직전 태그 (선택적)

/srv/s210/<env>/logs/<timestamp>/
  ps.txt                        ← docker ps -a 덤프
  compose.log                   ← docker compose logs 덤프
```

## 전형적 배포 흐름

```
generate-env.sh dev
build-frontend.sh              (build_* 3개 병렬)
build-backend.sh
build-ai.sh
deploy-dev.sh                  (ERR trap → rollback + 로그 dump)
```

## Runner/서버 필수 패키지

- `docker`, `docker compose` v2
- `curl`
- `jq` (notify.sh용. 한 번만: `sudo apt install -y jq`)

## 규약

- deploy 스크립트는 `--no-build` 전제 — 이미지는 registry에서 pull. build는 별도 stage
- `rollback-*.sh`는 state 파일을 건드리지 않음. 이미 known-good인 태그로 되돌릴 뿐
- 모든 script 재실행(idempotent) 안전
