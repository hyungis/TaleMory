# Service Mapping

## 서비스 → 파일 / Prefix 매핑

| 서비스 | 선언 소스 (로컬) | 선언 소스 (CI) | GitLab Variable prefix | 코드 스캔 경로 | 참조 패턴 |
|---|---|---|---|---|---|
| backend | `infra/env/app.local.env.example` | `infra/env/README.md` 3-3 | `ENV_<TARGET>_BACKEND_` | `app/backend/src/` (`application*.yml` + Kotlin) | `${KEY}`, `@Value("\${KEY}")` (tracked 원본은 `application-example.yml`; `application.yml`은 Dockerfile이 build 시점에 auto-derive) |
| frontend | `infra/env/app.local.env.example` | 3-4 | `ENV_<TARGET>_FRONTEND_` | `app/frontend/src/` | `import.meta.env.VITE_KEY` |
| ai | `infra/env/app.local.env.example` | 3-5 | `ENV_<TARGET>_AI_` | `app/ai/` | `os.getenv("KEY")`, `os.environ["KEY"]` |
| infra | `infra/env/infra.local.env.example` | 3-6 | `ENV_<TARGET>_INFRA_` | `infra/compose/docker-compose.{app,infra}-{local,dev,master}.yml` | compose yml의 `${KEY}` |

루트 `.env` / `.env.example`는 **더 이상 존재하지 않는다**. compose 프로젝트명은 `docker-compose.app-local.yml` 상단의 `name: s210-local`로 고정되고, 두 compose 파일의 병합은 `include:` 지시자가 담당한다. 포트 override / `VITE_API_BASE_URL` 등은 필요 시 실행 시점 shell env로 주입한다.

## 환경 매핑

| 환경 (파일명/컨테이너 접두사) | TARGET (GitLab Variable prefix) |
|---|---|
| 로컬 | (환경 분리 없음, 단일 `.env`) |
| `dev` | `DEV` |
| `master` | `MASTER` |

CI 출력 파일:
- `/tmp/env/app.dev.env`, `/tmp/env/app.master.env`
- `/tmp/env/infra.dev.env`, `/tmp/env/infra.master.env`

로컬 출력 파일:
- `infra/env/app.local.env` (backend/frontend/ai)
- `infra/env/infra.local.env` (mysql/redis/rabbitmq)
- 루트 `.env` 없음

## compose에서의 참조 위치

- **`infra/compose/docker-compose.{app,infra}-local.yml`** (로컬): `env_file:` 로 `infra/env/*.local.env` 직접 주입. `docker-compose.app-local.yml` 상단의 `include:`로 infra-local.yml을 merge해서 기동. `${KEY}` 형태의 compose-parse-time 치환은 포트 override 같은 선택적 shell env에만 사용.
- **`infra/compose/docker-compose.{app,infra}-{dev,master}.yml`** (CI): `env_file: ${ENV_DIR:-/tmp/env}/...` 로 파일째 주입 (prefix-stripped 출력)
- `services.<svc>.ports` — `${KEY}:3306` 같은 포트 substitution
- `services.<svc>.image` — 이미지 태그 조립

### compose 전용 변수 (앱 코드와 무관)

`whitelist.md`의 Compose/CI 표준 섹션 참고:

- `REGISTRY`, `APP_IMAGE_TAG`, `ENV_DIR`, `COMPOSE_PROJECT_NAME`
- `FRONTEND_PORT`, `BACKEND_PORT`, `AI_PORT`, `MYSQL_PORT`, `REDIS_PORT`, `RABBITMQ_PORT`, `RABBITMQ_MGMT_PORT`

## Vite prefix 규칙 (중요)

Vite는 빌드 시 환경변수 중 **`VITE_*`만 클라이언트 번들에 주입**한다. frontend 대상 키 추가 시:

- 반드시 `VITE_` prefix로 시작 (`VITE_API_BASE_URL`, `VITE_AUTH_USE_MOCK` 등)
- 그렇지 않으면 `import.meta.env.KEY`가 빌드 타임에 `undefined`로 치환됨

add 모드에서 frontend 대상이면 이 규칙을 사용자에게 확인 후 진행.

## 환경별 값 다르게 쓰기

환경에 따라 다른 값이 필요한 변수:
- `ENV_DEV_BACKEND_DB_PASSWORD` vs `ENV_MASTER_BACKEND_DB_PASSWORD`
- `ENV_DEV_FRONTEND_FRONTEND_PORT=3001` vs `ENV_MASTER_FRONTEND_FRONTEND_PORT=80`

dev/master 공통값은 `ENV_BASE_*`로 넣으면 generate-env.sh가 양쪽 파일에 모두 주입. 하지만 실제로는 거의 다르므로 `ENV_BASE_*`는 드물게만 사용.

## 참고: generate-env.sh의 동작

`infra/scripts/generate-env.sh <target>`이 GitLab Variables의 prefix를 벗겨 env 파일로 변환:

```
ENV_DEV_BACKEND_DB_PASSWORD=xxx   →   DB_PASSWORD=xxx   (in app.dev.env)
ENV_DEV_INFRA_MYSQL_ROOT_PASSWORD=yyy   →   MYSQL_ROOT_PASSWORD=yyy   (in infra.dev.env)
```

즉 `infra/env/README.md`의 테이블에는 **prefix 없는 최종 키 이름**으로 기재 (`DB_PASSWORD`, `ENV_DEV_BACKEND_DB_PASSWORD` 아님). prefix는 GitLab Variables 등록 시점에만 붙는 메타데이터.

## 파일 위치 체크리스트

스킬이 조회/수정하는 파일들 요약:

| 파일 | 읽기 | 쓰기 (add 모드) | 쓰기 (gitlab-vars 모드) |
|---|---|---|---|
| `infra/env/app.local.env.example` | ✅ check | ✅ (backend/frontend/ai) | — |
| `infra/env/infra.local.env.example` | ✅ check | ✅ (infra) | — |
| `infra/env/README.md` | ✅ check | ✅ | — |
| `docs/gitlab-variables.md` | ✅ (체크박스 보존용) | — | ✅ (재생성) |
| `app/backend/src/**/*.{yml,kt}` (tracked 원본은 `application-example.yml`) | ✅ check | ❌ (힌트만, `application-example.yml`만 갱신) | — |
| `app/frontend/src/**/*.{ts,tsx}` | ✅ check | ❌ | — |
| `app/ai/**/*.py` | ✅ check | ❌ | — |
| `infra/compose/docker-compose.{app,infra}-local.yml` | ✅ check | 선택적 (infra 서비스 `environment:` 추가 시) | — |
| `infra/compose/docker-compose.{app,infra}-{dev,master}.yml` | ✅ check | 보통 불필요 | — |
