# Infra Layout

S210 프로젝트의 인프라 코드. Stateful 기반 인프라(MySQL/Redis/RabbitMQ)와 stateless 앱 서비스(backend, frontend via nginx, ai)를 분리하고, CI/CD 스크립트를 한곳에 모아둠.

## Structure

```
infra/
  compose/
    docker-compose.app-dev.yml        ← dev 앱 (nginx + backend + ai)
    docker-compose.app-master.yml     ← master 앱
    docker-compose.infra-dev.yml      ← dev mysql/redis/rabbitmq
    docker-compose.infra-master.yml   ← master 같은 구성, 포트만 다름
  docker/
    frontend.Dockerfile               ← multi-stage: React build → nginx
  nginx/
    nginx.common.conf                 ← proxy header 공용
    nginx.dev.conf                    ← dev용 upstream (dev-backend, dev-ai)
    nginx.prod.conf                   ← master용 upstream (prod-backend, prod-ai)
  env/
    README.md                         ← GitLab Variables → env 파일 변환 규칙
    app.local.env.example             ← 로컬 app 스택
    infra.local.env.example           ← 로컬 infra 스택
  scripts/
    README.md                         ← 스크립트 카탈로그
    common.sh
    generate-env.sh
    build-frontend.sh / build-backend.sh / build-ai.sh
    deploy-dev.sh / deploy-master.sh
    deploy-infra-dev.sh / deploy-infra-master.sh
    health-check-dev.sh / health-check-master.sh
    notify.sh
  README.md                           ← 이 파일
```

**backend/ai Dockerfile은 각 앱 하위에 둠** (`app/backend/Dockerfile`, `app/ai/Dockerfile`). frontend만 nginx와 합쳐야 하므로 `infra/docker/frontend.Dockerfile`로 분리.

## 역할

- `compose/`: 환경별로 완전히 분리된 compose 파일. dev/master 같은 서버에서 동시 실행 가능하도록 컨테이너명(`dev-*`, `prod-*`), 포트, 네트워크 모두 분리
- `docker/`: 리포 전체 컨텍스트가 필요한 Dockerfile만. frontend는 React 빌드 결과를 nginx에 박아야 하므로 여기
- `nginx/`: 호스트에서 mount해서 주입. 이미지 하나로 dev/prod 공유
- `env/`: GitLab Variables 네이밍 규칙과 변환 파이프라인 문서. 실 env 파일은 CI 실행 시점에 `generate-env.sh`가 생성(커밋 안 됨)
- `scripts/`: 모든 bash script. `scripts/README.md` 참고

## 컨테이너/포트 레이아웃

| 서비스 | dev (컨테이너 / 호스트 포트) | master (컨테이너 / 호스트 포트) |
|---|---|---|
| nginx (외부 진입) | `dev-nginx` / 3001 | `prod-nginx` / 80 |
| backend | `dev-backend` / 8081 | `prod-backend` / 8080 |
| ai | `dev-ai` / 8001 | `prod-ai` / 8000 |
| mysql | `dev-mysql` / 3307 | `prod-mysql` / 3306 |
| redis | `dev-redis` / 6380 | `prod-redis` / 6379 |
| rabbitmq | `dev-rabbitmq` / 5673, 15673 | `prod-rabbitmq` / 5672, 15672 |

각 포트는 `${FRONTEND_PORT}`, `${BACKEND_PORT}`, `${AI_PORT}` 등 env로 override 가능.

> backend/ai를 외부로 직접 publish하는 건 nginx 우회 경로가 됩니다. 실 운영에선 서버 방화벽으로 내부/오피스 IP에서만 접근 가능하도록 막아주세요.

## 네트워크

- `dev-s210-app-net` + `dev-s210-infra-net` (external)
- `prod-s210-app-net` + `prod-s210-infra-net` (external)
- `infra-*` 네트워크는 `infra-<env>` compose에서 소유, `app-<env>` compose는 external로 참조

## CI/CD 배포 흐름 (환경별)

```
dev 브랜치로 merge
  → generate-env.sh dev
  → build-frontend / build-backend / build-ai       (3개 병렬, 각자 registry push)
  → deploy-dev.sh                                   (pull + up + health check)
  → health-check-dev.sh
  → notify.sh success/failure                       (Discord)
```

master도 구조는 같지만 `deploy-master.sh`가 **manual 승인 후 실행**. 자동 rollback 없음 — 실패 시 pipeline이 fail로 끝나고 팀이 직접 복구 (`git revert` 또는 GitLab `APP_IMAGE_TAG` override 재실행).

전체 흐름은 [docs/ci-cd-pipeline-flow.md](../docs/ci-cd-pipeline-flow.md) 참고.

## 수동 운영

### 기반 인프라(mysql/redis/rabbitmq) 띄우기

```bash
bash infra/scripts/deploy-infra-dev.sh        # dev
bash infra/scripts/deploy-infra-master.sh     # master
```

앱 배포와 **분리**되어 상시 상주. compose 변경 있을 때만 실행.

### 장애 복구

자동 rollback 로직 없음. 실패 시 선택지:

1. **정방향 복구** (원칙): `git revert <bad_sha>` → push → 새 pipeline이 이전 커밋으로 배포.
2. **긴급 복구**: GitLab → CI/CD → Pipelines → 이전 SHA의 pipeline 재실행, 또는 Pipeline 변수로 `APP_IMAGE_TAG=<prev_short_sha>` 설정 후 `deploy_*` job만 재실행.

두 방식 모두 **이전 이미지가 registry에 살아 있어야** 작동 → registry cleanup policy는 "최근 N개(예: 10) 유지"로 여유를 둘 것.

## 주의사항

- Flyway migration은 backend 기동 시 자동 실행 (`app/backend/src/main/resources/db/migration/Vn__*.sql`)
- 인프라 compose(mysql 등)는 Flyway 대상 아님 — 사용자/DB 생성만 담당
- Cross-compose 순서: `infra-*` → `app-*` 순으로 올려야 함 (app은 `infra-*-net` external 참조)
- 이미지 태그는 `$CI_COMMIT_SHORT_SHA` — 덮어쓰기 없음. 긴급 복구의 전제
