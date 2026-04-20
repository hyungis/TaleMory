# Env Management

실 env 파일은 commit 안 함. `infra/scripts/generate-env.sh`가 GitLab CI/CD Variables를 읽어 pipeline 실행 시점에 생성.

## 왜

- Secrets는 GitLab에만 존재. 디스크에는 pipeline 돌 때만 기록
- 같은 codebase가 브랜치별(dev/master)로 다른 env 생성
- `.env.example`은 키 목록 문서일 뿐. 이걸 고쳐도 배포에 반영 안 됨

## 변수 네이밍

| Prefix | 대상 파일 | 예시 |
|---|---|---|
| `ENV_BASE_` | `app.<target>.env` + `infra.<target>.env` 양쪽 | `ENV_BASE_REDIS_HOST=redis` |
| `ENV_<TARGET>_BACKEND_` | `app.<target>.env` | `ENV_DEV_BACKEND_DB_PASSWORD=...` |
| `ENV_<TARGET>_FRONTEND_` | `app.<target>.env` | `ENV_DEV_FRONTEND_AUTH_USE_MOCK=true` |
| `ENV_<TARGET>_AI_` | `app.<target>.env` | `ENV_DEV_AI_OPENAI_API_KEY=sk-…` |
| `ENV_<TARGET>_INFRA_` | `infra.<target>.env` | `ENV_DEV_INFRA_MYSQL_ROOT_PASSWORD=…` |

`<TARGET>` ∈ `DEV`, `MASTER`.

## 변환 규칙

Prefix를 떼고 남은 키만 파일에 기록:

```
ENV_BASE_REDIS_HOST=redis            → REDIS_HOST=redis   (app.dev.env + infra.dev.env 모두)
ENV_DEV_BACKEND_DB_PASSWORD=xxx      → DB_PASSWORD=xxx    (app.dev.env)
ENV_DEV_INFRA_MYSQL_ROOT_PASSWORD=y  → MYSQL_ROOT_PASSWORD=y  (infra.dev.env)
```

## 생성되는 파일

```
/tmp/env/
  app.dev.env        ← backend + frontend + ai 변수를 한 파일에 합침 (+ BASE)
  app.master.env
  infra.dev.env      ← MySQL/Redis/RabbitMQ 변수 (+ BASE)
  infra.master.env
```

compose는 `${ENV_DIR:-/tmp/env}/<file>` 형식으로 참조. Linux 배포 서버에선 `ENV_DIR` 미설정 → 기본값 `/tmp/env/`.

## 필수 변수 (최소)

### `ENV_BASE_*`
- `REDIS_HOST`, `REDIS_PORT`
- `RABBITMQ_HOST`, `RABBITMQ_PORT`
- `DB_HOST`, `DB_PORT`, `DB_NAME`

### `ENV_<TARGET>_BACKEND_*`
- `SPRING_PROFILES_ACTIVE`
- `SERVER_PORT`
- `DB_USERNAME`, `DB_PASSWORD`
- `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`

### `ENV_<TARGET>_FRONTEND_*`
- `VITE_API_BASE_URL` (build time)
- `FRONTEND_PORT` (nginx publish port)

### `ENV_<TARGET>_AI_*`
- `OPENAI_API_KEY`
- 모델/엔드포인트 설정

### `ENV_<TARGET>_INFRA_*`
- `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`
- `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`

## 새 변수 추가

1. GitLab → Settings → CI/CD → Variables에 `ENV_<TARGET>_<SERVICE>_<KEY>` 규칙으로 추가
2. Secret은 **Masked**, 보호 브랜치에서만 쓰면 **Protected** 체크
3. 앱 코드는 prefix 없는 key(`<KEY>`)로 읽음
4. `.env.example`에 key만 추가(값 없이). 문서 동기화 목적.
