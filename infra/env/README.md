# GitLab CI/CD Variables 카탈로그

S210의 **CI/운영 배포용** 환경변수 단일 문서. GitLab → **Settings → CI/CD → Variables**에 등록하는 모든 키를 여기서 관리한다.

> **로컬 개발 env는 이 문서와 무관**. 로컬은 repo 루트의 `.env.example` 참조.

---

## 1. 동작 원리

```
GitLab CI Variables (ENV_DEV_APP_DB_PASSWORD=xxx …)
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
| `ENV_<TARGET>_APP_<KEY>` | `app.<target>.env` | backend + frontend + ai |
| `ENV_<TARGET>_INFRA_<KEY>` | `infra.<target>.env` | mysql / redis / rabbitmq |

`<TARGET>` ∈ `DEV`, `MASTER`.

변환 예시:

```
ENV_BASE_REDIS_HOST=redis          → REDIS_HOST=redis            (양쪽 파일)
ENV_DEV_APP_DB_PASSWORD=xxx        → DB_PASSWORD=xxx             (app.dev.env)
ENV_DEV_INFRA_MYSQL_PASSWORD=xxx   → MYSQL_PASSWORD=xxx          (infra.dev.env)
```

---

## 3. 전체 키 카탈로그

### 3-1. 시스템 (prefix 없음 — 그대로 등록)

| Key | Type | Masked | 설명 |
|---|---|---|---|
| `DISCORD_WEBHOOK_URL` | Variable | ✅ | notify.sh가 쓸 Discord 웹후크 |

> Container Registry 미사용이라 `CI_REGISTRY_*` 관련 변수는 쓰지 않음. 추후 registry 도입 시 GitLab이 자동 주입하는 값을 그대로 사용 가능.

### 3-2. ENV_BASE_* (dev/master 공통)

실무상 거의 비워둠. 환경별 값이 다른 게 보통이라 `ENV_<TARGET>_*`를 주로 사용.

### 3-3. ENV_DEV_APP_* — dev 앱 (backend + frontend + ai)

| Key | Masked | 설명 |
|---|---|---|
| `ENV_DEV_APP_SPRING_PROFILES_ACTIVE` | — | `dev` |
| `ENV_DEV_APP_DB_URL` | — | `jdbc:mysql://dev-mysql:3306/iportfolio?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC` |
| `ENV_DEV_APP_DB_USERNAME` | — | DB 유저 (보통 `app`) |
| `ENV_DEV_APP_DB_PASSWORD` | ✅ | DB 비밀번호 — INFRA_MYSQL_PASSWORD와 동일값 |
| `ENV_DEV_APP_REDIS_HOST` | — | `dev-redis` |
| `ENV_DEV_APP_REDIS_PORT` | — | `6379` (내부 포트) |
| `ENV_DEV_APP_REDIS_PASSWORD` | ✅ | INFRA_REDIS_PASSWORD와 동일값 |
| `ENV_DEV_APP_RABBITMQ_HOST` | — | `dev-rabbitmq` |
| `ENV_DEV_APP_RABBITMQ_PORT` | — | `5672` |
| `ENV_DEV_APP_RABBITMQ_USERNAME` | ✅ | INFRA_RABBITMQ_DEFAULT_USER와 동일값 |
| `ENV_DEV_APP_RABBITMQ_PASSWORD` | ✅ | INFRA_RABBITMQ_DEFAULT_PASS와 동일값 |
| `ENV_DEV_APP_JWT_ACCESS_SECRET` | ✅ | JWT access token 서명 키. `openssl rand -base64 48`로 생성 권장 |
| `ENV_DEV_APP_JWT_REFRESH_SECRET` | ✅ | JWT refresh token 서명 키. access와 **다른 값** 사용 |
| `ENV_DEV_APP_FRONTEND_OAUTH_CALLBACK_URI` | — | dev frontend OAuth callback URI (`https://<dev-frontend-host>/auth/oauth/callback`) |
| `ENV_DEV_APP_FRONTEND_OAUTH_LOGOUT_CALLBACK_URI` | — | dev frontend logout callback URI (`https://<dev-frontend-host>/auth/logout/callback`) |
| `ENV_DEV_APP_KAKAO_CLIENT_ID` | — | dev Kakao REST API key |
| `ENV_DEV_APP_KAKAO_CLIENT_SECRET` | ✅ | dev Kakao client secret |
| `ENV_DEV_APP_KAKAO_REDIRECT_URI` | — | dev backend Kakao callback URI (`https://<dev-frontend-host>/api/auth/oauth/kakao/callback`) |
| `ENV_DEV_APP_KAKAO_LOGOUT_REDIRECT_URI` | — | dev backend Kakao logout callback URI (`https://<dev-frontend-host>/api/auth/oauth/kakao/logout/callback`) |
| `ENV_DEV_APP_AWS_ACCESS_KEY_ID` | ✅ | `s210-backend-s3` IAM user Access Key ID (S3 presign / 소프트삭제용) |
| `ENV_DEV_APP_AWS_SECRET_ACCESS_KEY` | ✅ | `s210-backend-s3` IAM user Secret Access Key |
| `ENV_DEV_APP_AWS_REGION` | — | `ap-northeast-2` (AWS SDK 표준 env 이름 — region 자동 인식용) |
| `ENV_DEV_APP_AWS_S3_BUCKET` | — | `s210-iportfolio-dev` — 사용자 사진 + 생성 이미지 저장 버킷 |
| `ENV_DEV_APP_FRONTEND_PORT` | — | `3001` (호스트 publish 포트) |
| `ENV_DEV_APP_VITE_API_BASE_URL` | — | `/api` (Vite build-time 주입) |
| `ENV_DEV_APP_OPENAI_API_KEY` | ✅ | OpenAI API 키 |
| `ENV_DEV_APP_PROJECT_NAME` | — | `S210 AI API` |
| `ENV_DEV_APP_APP_VERSION` | — | `0.1.0` |
| `ENV_DEV_APP_ENVIRONMENT` | — | `local` |
| `ENV_DEV_APP_STORYBOARD_MODEL` | — | `gpt-4o-mini` |
| `ENV_DEV_APP_STORYBOARD_INPUT_COST_PER_1M` | — | `0.15` |
| `ENV_DEV_APP_STORYBOARD_OUTPUT_COST_PER_1M` | — | `0.60` |
| `ENV_DEV_APP_RABBITMQ_VHOST` | — | `/` |
| `ENV_DEV_APP_RABBITMQ_REQUEST_EXCHANGE` | — | `storyboard.request` |
| `ENV_DEV_APP_RABBITMQ_RESULT_EXCHANGE` | — | `storyboard.result` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_QUEUE` | — | `storyboard.generate.request` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_QUEUE` | — | `storyboard.regenerate.request` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_ROUTING_KEY` | — | `storyboard.generate` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_ROUTING_KEY` | — | `storyboard.regenerate` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY` | — | `storyboard.generate.completed` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_FAILED_ROUTING_KEY` | — | `storyboard.generate.failed` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY` | — | `storyboard.regenerate.completed` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_FAILED_ROUTING_KEY` | — | `storyboard.regenerate.failed` |
| `ENV_DEV_APP_AI_WORKER_REPLICAS` | — | `1` (AI worker 컨테이너 복제본 수. compose `scale:` 키로 적용) |

> Vite는 `VITE_` prefix만 클라이언트 번들에 주입. 새 frontend 변수 이름은 반드시 `VITE_`로 시작해야 함.

### 3-4. ENV_DEV_INFRA_* — dev 인프라

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

### 3-5. ENV_MASTER_*

위 `ENV_DEV_*` 전부를 **이름만 `MASTER`로** 바꾸고 **값은 운영용으로** 교체.

주요 값 차이:

| Key | dev 값 | master 값 |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `dev` | `prod` |
| `DB_URL` 호스트 | `dev-mysql` | `prod-mysql` |
| `DB_URL` DB명 | `iportfolio` | (운영 DB명으로 교체 — 팀 결정) |
| `REDIS_HOST` | `dev-redis` | `prod-redis` |
| `RABBITMQ_HOST` | `dev-rabbitmq` | `prod-rabbitmq` |
| `JWT_ACCESS_SECRET` | (dev 전용 값) | (master 전용 값, **절대 dev와 공유 금지**) |
| `JWT_REFRESH_SECRET` | (dev 전용 값) | (master 전용 값, **access와도 다르게**) |
| `FRONTEND_OAUTH_CALLBACK_URI` | `https://<dev-frontend-host>/auth/oauth/callback` | `https://k14s210.p.ssafy.io/auth/oauth/callback` |
| `FRONTEND_OAUTH_LOGOUT_CALLBACK_URI` | `https://<dev-frontend-host>/auth/logout/callback` | `https://k14s210.p.ssafy.io/auth/logout/callback` |
| `KAKAO_CLIENT_ID` | (dev Kakao REST API key) | (prod Kakao REST API key) |
| `KAKAO_CLIENT_SECRET` | (dev Kakao client secret) | (prod Kakao client secret) |
| `KAKAO_REDIRECT_URI` | `https://<dev-frontend-host>/api/auth/oauth/kakao/callback` | `https://k14s210.p.ssafy.io/api/auth/oauth/kakao/callback` |
| `KAKAO_LOGOUT_REDIRECT_URI` | `https://<dev-frontend-host>/api/auth/oauth/kakao/logout/callback` | `https://k14s210.p.ssafy.io/api/auth/oauth/kakao/logout/callback` |
| `FRONTEND_PORT` | `3001` | `80` |
| `MYSQL_PORT` | `3307` | `3306` |
| `REDIS_PORT` | `6380` | `6379` |
| `RABBITMQ_PORT` | `5673` | `5672` |
| `RABBITMQ_MANAGEMENT_PORT` | `15673` | `15672` |
| `AI_WORKER_REPLICAS` | `1` | `2` (권장 — 병렬 OpenAI 처리량 확보) |

JWT secret 생성 (로컬에서, 4개 전부 각자):
```bash
openssl rand -base64 64 | tr -d '\n'
```
출력은 대화/채팅/이메일에 붙이지 말고 GitLab Variables에 직접 입력.

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
/env-sync add OPENAI_MODEL app
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
---

## APP Env Appendix (AI 출처)

AI 서비스가 사용하는 `ENV_DEV_APP_*` 변수 중 `OPENAI_API_KEY` 외 추가 키 목록. RABBITMQ_HOST/PORT/USERNAME/PASSWORD는 backend 출처와 통합되어 중복 제거됨.

### DEV APP (AI 출처)

| Key | Masked | Example |
|---|---|---|
| `ENV_DEV_APP_PROJECT_NAME` | no | `S210 AI API` |
| `ENV_DEV_APP_APP_VERSION` | no | `0.1.0` |
| `ENV_DEV_APP_ENVIRONMENT` | no | `local` |
| `ENV_DEV_APP_STORYBOARD_MODEL` | no | `gpt-4o-mini` |
| `ENV_DEV_APP_STORYBOARD_INPUT_COST_PER_1M` | no | `0.15` |
| `ENV_DEV_APP_STORYBOARD_OUTPUT_COST_PER_1M` | no | `0.60` |
| `ENV_DEV_APP_RABBITMQ_VHOST` | no | `/` |
| `ENV_DEV_APP_RABBITMQ_REQUEST_EXCHANGE` | no | `storyboard.request` |
| `ENV_DEV_APP_RABBITMQ_RESULT_EXCHANGE` | no | `storyboard.result` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_QUEUE` | no | `storyboard.generate.request` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_QUEUE` | no | `storyboard.regenerate.request` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_ROUTING_KEY` | no | `storyboard.generate` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_ROUTING_KEY` | no | `storyboard.regenerate` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY` | no | `storyboard.generate.completed` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_FAILED_ROUTING_KEY` | no | `storyboard.generate.failed` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY` | no | `storyboard.regenerate.completed` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_FAILED_ROUTING_KEY` | no | `storyboard.regenerate.failed` |
| `ENV_DEV_APP_AI_WORKER_REPLICAS` | no | `1` |

### MASTER APP (AI 출처)

| Key | Masked | Example |
|---|---|---|
| `ENV_MASTER_APP_PROJECT_NAME` | no | `S210 AI API` |
| `ENV_MASTER_APP_APP_VERSION` | no | `0.1.0` |
| `ENV_MASTER_APP_ENVIRONMENT` | no | `master` |
| `ENV_MASTER_APP_STORYBOARD_MODEL` | no | `gpt-4o-mini` |
| `ENV_MASTER_APP_STORYBOARD_INPUT_COST_PER_1M` | no | `0.15` |
| `ENV_MASTER_APP_STORYBOARD_OUTPUT_COST_PER_1M` | no | `0.60` |
| `ENV_MASTER_APP_RABBITMQ_VHOST` | no | `/` |
| `ENV_MASTER_APP_RABBITMQ_REQUEST_EXCHANGE` | no | `storyboard.request` |
| `ENV_MASTER_APP_RABBITMQ_RESULT_EXCHANGE` | no | `storyboard.result` |
| `ENV_MASTER_APP_RABBITMQ_GENERATE_QUEUE` | no | `storyboard.generate.request` |
| `ENV_MASTER_APP_RABBITMQ_REGENERATE_QUEUE` | no | `storyboard.regenerate.request` |
| `ENV_MASTER_APP_RABBITMQ_GENERATE_ROUTING_KEY` | no | `storyboard.generate` |
| `ENV_MASTER_APP_RABBITMQ_REGENERATE_ROUTING_KEY` | no | `storyboard.regenerate` |
| `ENV_MASTER_APP_RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY` | no | `storyboard.generate.completed` |
| `ENV_MASTER_APP_RABBITMQ_GENERATE_FAILED_ROUTING_KEY` | no | `storyboard.generate.failed` |
| `ENV_MASTER_APP_RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY` | no | `storyboard.regenerate.completed` |
| `ENV_MASTER_APP_RABBITMQ_REGENERATE_FAILED_ROUTING_KEY` | no | `storyboard.regenerate.failed` |
| `ENV_MASTER_APP_AI_WORKER_REPLICAS` | no | `2` |
