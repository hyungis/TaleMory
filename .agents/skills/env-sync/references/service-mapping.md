# Service Mapping

## 서비스 → 파일 / Prefix 매핑

| 서비스 | env 예시 파일 | GitLab Variable prefix | 코드 스캔 경로 | 참조 패턴 |
|---|---|---|---|---|
| backend | `infra/env/app.<env>.env.example` | `ENV_<TARGET>_BACKEND_` | `app/backend/src/` | `${KEY}`, `@Value("\${KEY}")` |
| frontend | `infra/env/app.<env>.env.example` | `ENV_<TARGET>_FRONTEND_` | `app/frontend/src/` | `import.meta.env.VITE_KEY` |
| ai | `infra/env/app.<env>.env.example` | `ENV_<TARGET>_AI_` | `app/ai/` | `os.getenv("KEY")`, `os.environ["KEY"]` |
| infra | `infra/env/infra.<env>.env.example` | `ENV_<TARGET>_INFRA_` | `infra/compose/` | compose yml의 `${KEY}` |

## 환경 매핑

| 환경 (파일명) | TARGET (GitLab Variable) |
|---|---|
| `dev` | `DEV` |
| `master` | `MASTER` |

파일명 조합:
- `app.dev.env`, `app.master.env`
- `infra.dev.env`, `infra.master.env`

## compose에서의 참조 위치

- `services.<svc>.env_file` — 파일째 주입 (가장 흔함, 키별 추가 참조 불필요)
- `services.<svc>.environment` — 개별 키 주입
- `services.<svc>.ports` — `${KEY}:3306` 같은 포트 substitution
- `services.<svc>.image` — 이미지 태그 조립: `${REGISTRY:+${REGISTRY}/}s210-<svc>:${APP_IMAGE_TAG:-latest}`

### compose 전용 변수 (앱 코드와 무관)

- `REGISTRY` — `CI_REGISTRY_IMAGE` 기준
- `APP_IMAGE_TAG` — `CI_COMMIT_SHORT_SHA`
- `ENV_DIR` — 로컬/CI 경로 스위치
- `COMPOSE_PROJECT_NAME` — 프로젝트 식별자

이 변수들은 orphan 검사에서 `whitelist.md`로 제외.

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

## 참조 없는 compose-only 키의 예외 처리

`COMPOSE_PROJECT_NAME`처럼 compose yml 안에서만 쓰이는 키는 코드 grep에 안 걸림. 하지만 compose config 검증 시 필요하므로 orphan으로 판정하면 안 됨.

해결: `whitelist.md`에 "Compose 표준" 카테고리로 등록.

## 참고: generate-env.sh의 동작

`infra/scripts/generate-env.sh <target>`이 GitLab Variables의 prefix를 벗겨 env 파일로 변환:

```
ENV_DEV_BACKEND_DB_PASSWORD=xxx   →   DB_PASSWORD=xxx   (in app.dev.env)
ENV_DEV_INFRA_MYSQL_ROOT_PASSWORD=yyy   →   MYSQL_ROOT_PASSWORD=yyy   (in infra.dev.env)
```

즉 `.env.example`에는 prefix 없는 최종 키 이름으로 적는다 (`DB_PASSWORD`, 아니고 `ENV_DEV_BACKEND_DB_PASSWORD` 아님).
