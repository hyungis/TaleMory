# GitLab CI/CD Variables 카탈로그

S210의 **CI/운영 배포용** 환경변수 단일 문서. GitLab → **Settings → CI/CD → Variables**에 등록하는 모든 키를 여기서 관리한다.

> **로컬 개발 env는 이 문서와 무관**. 로컬은 repo 루트의 `.env.example` 참조.

---

## 1. 동작 원리

```
GitLab CI Variables (ENV_DEV_BACKEND_DB_PASSWORD=xxx …)
          │
          ▼
pipeline 실행 시 job 환경변수로 주입
          │
          ▼
bash infra/scripts/generate-env.sh <dev|master>
          │
          ▼
prefix 제거 후 두 파일로 분리 출력:
  /tmp/env/app.<target>.env    ← backend + frontend + ai (+ BASE)
  /tmp/env/infra.<target>.env  ← mysql + redis + rabbitmq (+ BASE)
          │
          ▼
infra/compose/docker-compose.{app,infra}-<target>.yml 이 이 파일들을 env_file로 주입
```

`.env.example` 같은 실 파일이 repo에 없음. CI runtime에만 `/tmp/env/`에 존재 → pipeline 종료 시 runner ephemeral 스토리지라 정리됨 (project runner면 재부팅까지 유지).

---

## 2. 변수 네이밍 규칙

| Prefix 형식 | 투입되는 파일 | 대상 컨테이너 |
|---|---|---|
| `ENV_BASE_<KEY>` | `app.*.env` + `infra.*.env` 양쪽 | 공통 |
| `ENV_<TARGET>_BACKEND_<KEY>` | `app.<target>.env` | backend |
| `ENV_<TARGET>_FRONTEND_<KEY>` | `app.<target>.env` | frontend (nginx 이미지 build-time) |
| `ENV_<TARGET>_AI_<KEY>` | `app.<target>.env` | ai |
| `ENV_<TARGET>_INFRA_<KEY>` | `infra.<target>.env` | mysql / redis / rabbitmq |

`<TARGET>` ∈ `DEV`, `MASTER`.

변환 예시:

```
ENV_BASE_REDIS_HOST=redis          → REDIS_HOST=redis            (양쪽 파일)
ENV_DEV_BACKEND_DB_PASSWORD=xxx    → DB_PASSWORD=xxx             (app.dev.env)
ENV_DEV_INFRA_MYSQL_PASSWORD=xxx   → MYSQL_PASSWORD=xxx          (infra.dev.env)
```

---

## 3. 전체 키 카탈로그

### 3-1. 시스템 (prefix 없음 — 그대로 등록)

| Key | Type | Masked | Protected | 설명 |
|---|---|---|---|---|
| `DISCORD_WEBHOOK_URL` | Variable | ✅ | 선택 | notify.sh가 쓸 Discord 웹후크 |

> Container Registry 미사용이라 `CI_REGISTRY_*` 관련 변수는 쓰지 않음. 추후 registry 도입 시 GitLab이 자동 주입하는 값을 그대로 사용 가능.

### 3-2. ENV_BASE_* (dev/master 공통)

실무상 거의 비워둠. 환경별 값이 다른 게 보통이라 `ENV_<TARGET>_*`를 주로 사용.

### 3-3. ENV_DEV_BACKEND_* — dev 백엔드

| Key | Masked | 설명 |
|---|---|---|
| `ENV_DEV_BACKEND_SPRING_PROFILES_ACTIVE` | — | `dev` |
| `ENV_DEV_BACKEND_DB_URL` | — | `jdbc:mysql://dev-mysql:3306/iportfolio?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC` |
| `ENV_DEV_BACKEND_DB_USERNAME` | — | DB 유저 (보통 `app`) |
| `ENV_DEV_BACKEND_DB_PASSWORD` | ✅ | DB 비밀번호 — INFRA_MYSQL_PASSWORD와 동일값 |
| `ENV_DEV_BACKEND_REDIS_HOST` | — | `dev-redis` |
| `ENV_DEV_BACKEND_REDIS_PORT` | — | `6379` (내부 포트) |
| `ENV_DEV_BACKEND_REDIS_PASSWORD` | ✅ | — INFRA_REDIS_PASSWORD와 동일값 |
| `ENV_DEV_BACKEND_RABBITMQ_HOST` | — | `dev-rabbitmq` |
| `ENV_DEV_BACKEND_RABBITMQ_PORT` | — | `5672` |
| `ENV_DEV_BACKEND_RABBITMQ_USERNAME` | ✅ | INFRA_RABBITMQ_DEFAULT_USER와 동일값 |
| `ENV_DEV_BACKEND_RABBITMQ_PASSWORD` | ✅ | INFRA_RABBITMQ_DEFAULT_PASS와 동일값 |

### 3-4. ENV_DEV_FRONTEND_*

| Key | 설명 |
|---|---|
| `ENV_DEV_FRONTEND_FRONTEND_PORT` | `3001` (호스트 publish 포트) |
| `ENV_DEV_FRONTEND_VITE_API_BASE_URL` | `/api` (Vite build-time 주입) |

> Vite는 `VITE_` prefix만 클라이언트 번들에 주입. 새 frontend 변수 이름은 반드시 `VITE_`로 시작해야 함.

### 3-5. ENV_DEV_AI_*

| Key | Masked | 설명 |
|---|---|---|
| `ENV_DEV_AI_OPENAI_API_KEY` | ✅ | OpenAI API 키 |
| (추가 모델/엔드포인트 설정은 AI 담당자와 협의해 여기 확장) | | |

### 3-6. ENV_DEV_INFRA_* — dev 인프라

| Key | Masked | 설명 |
|---|---|---|
| `ENV_DEV_INFRA_MYSQL_ROOT_PASSWORD` | ✅ | MySQL root 비밀번호 |
| `ENV_DEV_INFRA_MYSQL_DATABASE` | — | `iportfolio` |
| `ENV_DEV_INFRA_MYSQL_USER` | — | `app` |
| `ENV_DEV_INFRA_MYSQL_PASSWORD` | ✅ | app 유저 비밀번호 — BACKEND_DB_PASSWORD와 동일값 |
| `ENV_DEV_INFRA_MYSQL_PORT` | — | `3307` (호스트 publish) |
| `ENV_DEV_INFRA_REDIS_PASSWORD` | ✅ | redis-server --requirepass 값 — BACKEND_REDIS_PASSWORD와 동일값 |
| `ENV_DEV_INFRA_REDIS_PORT` | — | `6380` (호스트 publish) |
| `ENV_DEV_INFRA_RABBITMQ_DEFAULT_USER` | ✅ | BACKEND_RABBITMQ_USERNAME과 동일값 |
| `ENV_DEV_INFRA_RABBITMQ_DEFAULT_PASS` | ✅ | BACKEND_RABBITMQ_PASSWORD와 동일값 |
| `ENV_DEV_INFRA_RABBITMQ_PORT` | — | `5673` |
| `ENV_DEV_INFRA_RABBITMQ_MANAGEMENT_PORT` | — | `15673` |

### 3-7. ENV_MASTER_*

위 `ENV_DEV_*` 전부를 **이름만 `MASTER`로** 바꾸고 **값은 운영용으로** 교체. **Masked 키 전체에 Protected ✅** 추가 체크.

주요 값 차이:

| Key | dev 값 | master 값 |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `dev` | `prod` |
| `DB_URL` 호스트 | `dev-mysql` | `prod-mysql` |
| `DB_URL` DB명 | `iportfolio` | (운영 DB명으로 교체 — 팀 결정) |
| `REDIS_HOST` | `dev-redis` | `prod-redis` |
| `RABBITMQ_HOST` | `dev-rabbitmq` | `prod-rabbitmq` |
| `FRONTEND_PORT` | `3001` | `80` |
| `MYSQL_PORT` | `3307` | `3306` |
| `REDIS_PORT` | `6380` | `6379` |
| `RABBITMQ_PORT` | `5673` | `5672` |
| `RABBITMQ_MANAGEMENT_PORT` | `15673` | `15672` |

---

## 4. 자동 생성 체크리스트

**`docs/gitlab-variables.md`**는 env-sync 스킬의 `gitlab-vars` 모드가 자동 생성하는 **등록 체크리스트**. 팀원이 GitLab 화면과 대조하며 체크박스로 진행 상황 관리 가능.

재생성:

```
/env-sync gitlab-vars
```

이 README와 `docs/gitlab-variables.md`의 차이:

| 파일 | 용도 | 수정 방식 |
|---|---|---|
| `infra/env/README.md` (이 파일) | **변수 체계 + 규칙 설명** (프로젝트 아키텍처 문서) | 수동 |
| `docs/gitlab-variables.md` | **실제 등록해야 할 키 목록 + 체크박스** | env-sync가 자동 생성 |

---

## 5. 새 변수 추가 프로세스

env-sync 스킬 `add` 모드로 처리:

```
/env-sync add OPENAI_MODEL backend
```

절차 (스킬이 자동 실행):

1. 루트 `.env.example`에 로컬용 키 추가 (기본값 포함)
2. 이 README의 해당 테이블에 행 추가
3. `docs/gitlab-variables.md` 재생성
4. 서비스 코드 수정 힌트 출력 (`application.yml` `${KEY}` 등) — 자동 수정 아님
5. GitLab Variables 등록 체크리스트 콘솔 출력

---

## 6. 변수 삭제 / 변경 시 주의

- 이미 등록된 GitLab Variables는 **수동으로 삭제**해야 함 (env-sync는 로컬 파일만 정리)
- 변경 시 기존 키를 두고 새 키 추가 후 점진 마이그레이션 권장
- 비밀번호 로테이션: 새 값으로 GitLab Variables 업데이트 → pipeline 재실행 → 구 값 제거
