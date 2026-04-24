# 로컬 개발 실행 가이드

S210 스택(mysql / redis / rabbitmq / backend / ai / nginx) 6개 컨테이너를 개발 PC에서 한 방에 띄우는 가이드.

**구조**: 로컬도 CI/운영과 똑같이 **app 스택**과 **infra 스택**이 분리된 두 compose 파일로 관리. 두 파일 모두 `name: s210-local`로 **같은 프로젝트**를 공유하며, 공유 기본 네트워크(`s210-local_default`)로 서비스명 DNS가 연결된다. **infra 먼저 → app 뒤에** 순서로 기동. 루트 `.env` 파일은 사용하지 않는다.

---

## 0. 전제 조건

- **Docker Desktop** 실행 중 (`docker ps` 헤더가 에러 없이 나와야 함)
- **Git Bash** 또는 WSL2 (bash 명령 사용)
- repo 루트에서 명령 실행

---

## 1. 최초 1회 셋업

### 1-1. env 파일 2개 복사

```bash
cp infra/env/app.local.env.example   infra/env/app.local.env
cp infra/env/infra.local.env.example infra/env/infra.local.env
```

두 파일 모두 `.gitignore`에 의해 자동으로 commit 제외됨. 루트 `.env`는 **만들지 않는다** — compose가 루트 `.env`를 자동 로드하면 의도치 않은 override가 생길 수 있으므로 없는 상태를 유지.

### 1-2. env 값 검토 (필요 시 편집)

- `infra/env/infra.local.env` — mysql/redis/rabbitmq 비밀번호. 기본 더미값 그대로 써도 로컬은 OK.
- `infra/env/app.local.env` — backend/ai 비밀번호 + `OPENAI_API_KEY` + Kakao OAuth env (`OAUTH_ALLOWED_REDIRECT_URIS`, `KAKAO_*`, `VITE_KAKAO_CLIENT_ID`). **infra.local.env의 비밀번호와 반드시 일치**해야 함 (`DB_PASSWORD=apppass`=`MYSQL_PASSWORD`, 등).
- 포트 override / `VITE_API_BASE_URL` override는 실행 시점 shell env로 주입: `BACKEND_PORT=18081 docker compose -f ... up`.
- Kakao 로그인은 frontend가 `window.location.origin` 기준으로 redirect URI를 동적으로 만들고, `POST /api/auth/kakao/callback` body의 `{ code, redirectUri }`를 backend에 전달한다. backend는 `redirectUri`를 `OAUTH_ALLOWED_REDIRECT_URIS` 화이트리스트와 비교한다.
- Kakao Developers 콘솔 Redirect URI에는 접근 가능한 각 frontend callback URI를 모두 등록.
  - `http://k14s210.p.ssafy.io:3001/auth/kakao/callback`
  - `https://k14s210.p.ssafy.io:3443/auth/kakao/callback`
  - `https://k14s210.p.ssafy.io/auth/kakao/callback`

### 1-3. 기존 `dev-*` 스택 청소 (있다면)

이전 가이드를 따라 `infra/env/` 기반으로 `dev-*` 컨테이너를 올려 본 적이 있다면:

```bash
docker compose -f infra/compose/docker-compose.infra-dev.yml -p s210-infra-dev down -v 2>/dev/null || true
docker compose -f infra/compose/docker-compose.app-dev.yml -p s210-app-dev down -v 2>/dev/null || true
```

깨끗한 상태에서 로컬 스택 시작.

### 1-4. (선택) shell alias 등록

매번 긴 `-f ...` 붙이는 게 번거로우면:

```bash
# Git Bash ~/.bashrc or zsh ~/.zshrc
alias dci='docker compose -f infra/compose/docker-compose.infra-local.yml'
alias dca='docker compose -f infra/compose/docker-compose.app-local.yml'
```

이후 `dci up -d`, `dca up -d --build`, `dca logs -f backend` 식으로 단축.

---

## 2. 기동 (2단계)

app이 infra에 의존하므로 반드시 순서대로:

```bash
# 1) infra 먼저
dci up -d

# 2) mysql이 healthy 될 때까지 대기 (20~30초)
dci ps        # mysql이 "Up (healthy)" 확인

# 3) app 기동 (첫 빌드만 5~10분)
dca up -d --build
```

- 두 compose 모두 `name: s210-local`이라 **같은 프로젝트**. 기본 네트워크 `s210-local_default`를 공유 → backend가 호스트명 `mysql`, `redis`, `rabbitmq`로 접근.
- `dci up -d`만 실행하면 MySQL/Redis/RabbitMQ만 올라감 (app 없이 infra 테스트 가능).
- app이 먼저 올라가도 backend는 연결 실패 → 2단계 순서 필수.

### 컨테이너 상태 확인

```bash
docker ps --filter "name=local-"
# 또는
dci ps && dca ps
```

기대 (STATUS):
- `mysql` → `Up (healthy)` (20~30초 후 healthy 전환)
- `redis`, `rabbitmq` → `Up`
- `backend` → `Up` (MySQL healthy 후 기동)
- `ai`, `nginx` → `Up`

---

## 3. 동작 확인

```bash
# Frontend (정적 + API 프록시)
curl http://localhost:3001/              # → HTTP 200
curl http://localhost:3001/api/          # → 401 (Spring Security 기본 응답; Tomcat alive 의미)
# ai-worker(RabbitMQ consumer)는 HTTP 엔드포인트가 없음. FastAPI를 직접 확인하려면
# docker 밖에서 `cd app/ai && uvicorn main:app --reload --port 8001` 실행.

# Backend 직접
curl http://localhost:8081/              # → 401

# AI 직접
curl http://localhost:8001/              # → HTTP 200

# MySQL
docker exec -it local-mysql mysql -uapp -papppass iportfolio

# Redis
docker exec local-redis redis-cli -a redispass ping      # → PONG

# RabbitMQ 관리 UI
# 브라우저: http://localhost:15673  (ID: rabbit / PW: rabbitpass)
```

> 컨테이너 이름 = `local-<service>` (ex. `local-mysql`, `local-backend`). compose 내부 DNS는 **짧은 서비스명**(`mysql`, `backend`, `redis`)으로 접근.

---

## 4. 자주 쓰는 명령

상세는 [local-commands.md](./local-commands.md) 참고. 요약:

```bash
# alias dci/dca 사용 (1-4 참조)

# 특정 서비스만 재빌드 (app 쪽)
dca up -d --build backend

# app만 종료 (infra 유지)
dca down

# 전체 종료 (app → infra 순)
dca down && dci down

# 전체 종료 + 볼륨 삭제 (DB 초기화 포함)
dca down && dci down -v

# 로그
dca logs -f backend
dci logs -f mysql
```

---

## 5. 포트 레이아웃 (로컬 기본값)

| 서비스 | 서비스명 (compose DNS) | 컨테이너명 | 호스트 포트 | 내부 포트 |
|---|---|---|---|---|
| frontend (nginx 외부 진입) | `nginx` | `local-nginx` | **3001** | 80 |
| backend | `backend` | `local-backend` | 8081 | 8080 |
| ai | `ai` | `local-ai` | 8001 | 8000 |
| mysql | `mysql` | `local-mysql` | 3307 | 3306 |
| redis | `redis` | `local-redis` | 6380 | 6379 |
| rabbitmq (AMQP) | `rabbitmq` | `local-rabbitmq` | 5673 | 5672 |
| rabbitmq (UI) | `rabbitmq` | `local-rabbitmq` | 15673 | 15672 |

외부 진입점은 **`http://localhost:3001`** 하나. backend/ai는 nginx 경유 또는 직접.

---

## 6. 두 compose 파일 구조

```
infra/compose/
  docker-compose.infra-local.yml    ← mysql / redis / rabbitmq (volumes 포함)
  docker-compose.app-local.yml      ← backend / ai / nginx (build context 포함)
  docker-compose.infra-dev.yml      ← CI 전용
  docker-compose.infra-master.yml   ← CI 전용
  docker-compose.app-dev.yml        ← CI 전용
  docker-compose.app-master.yml     ← CI 전용
```

로컬/CI가 같은 네이밍 패턴(`<target>-local|dev|master`)을 유지. 파일 하나를 수정해도 다른 환경이 깨지지 않음.

### 왜 공유 프로젝트명(`name: s210-local`) 방식인가

대안 비교:

1. **루트 `.env`의 `COMPOSE_FILE=A:B`** — 자동 merge되지만 `.env`를 강제로 유지해야 하고 `COMPOSE_PATH_SEPARATOR` 이슈 발생.
2. **`include:` 지시자** — app-local이 infra-local을 include로 merge. 한 명령으로 전체 기동 가능하지만, app과 infra의 lifecycle이 묶여 **"infra만 먼저 기동"이 어색**하고 container_name 충돌 여지.
3. **공유 프로젝트명 (현재 선택)** — 두 compose가 독립 파일이지만 같은 project/network를 공유. "app이 infra에 의존" 관계를 가장 명확히 표현.

`depends_on`이 cross-file이 돼서 compose validation에 걸리므로 backend에서는 제거. 대신 **사람이 mysql healthy 확인 후 app 기동** 워크플로를 문서화. Spring Boot / Flyway의 connection 재시도가 일부 완충.

---

## 7. 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| `env file ... not found` | `infra/env/app.local.env` 또는 `infra.local.env` 미생성. 1-1 단계 수행 |
| `port is already allocated` | 3001/8081/3307 등이 다른 프로세스 점유. `netstat -ano \| findstr 3001`로 확인 후 내림 |
| `invalid reference format` | Docker 빌드 캐시 꼬임. `docker builder prune -af` 후 재시도 |
| `MYSQL_DATABASE` 변경이 안 반영 | MySQL 볼륨에 기존 DB 있어 초기화 스킵됨. `dci down -v` 후 재기동 |
| backend `Flyway Communications link failure` | infra가 healthy 되기 전에 app을 기동. `dca restart backend` 또는 `dci ps`로 healthy 확인 후 재기동 |
| backend `Unable to resolve host: mysql` | infra가 안 올라간 상태에서 app 기동. `dci up -d` 먼저 |
| `Redis NOAUTH` | `application.yml`이 `${REDIS_PASSWORD}`를 참조하는지, `infra/env/app.local.env`에 값이 있는지 확인 |
| Kakao OAuth `redirect_uri mismatch` | `infra/env/app.local.env`의 `OAUTH_ALLOWED_REDIRECT_URIS`에 현재 frontend callback URI가 포함되는지, 그리고 Kakao Developers 콘솔에 동일한 Redirect URI가 등록되어 있는지 확인 |
| `pnpm install` 실패 | `app/frontend/pnpm-lock.yaml` 없으면 `cd app/frontend && pnpm install` 1회 |
| app만 down 했는데 infra도 죽음 | `--remove-orphans` 플래그가 있었을 가능성. 평소엔 그냥 `dca down`만 |

---

## 8. CI와의 차이 한눈에

| 항목 | 로컬 | CI (GitLab) |
|---|---|---|
| 사용 compose | `infra/compose/docker-compose.{app,infra}-local.yml` (`include:` merge) | `infra/compose/docker-compose.{app,infra}-{dev,master}.yml` (각자 `-f`) |
| env 소스 | `infra/env/{app,infra}.local.env` (수동 편집) | GitLab CI/CD Variables → `generate-env.sh` → `/tmp/env/*.env` |
| 이미지 | `docker compose --build` 로 로컬 빌드 | registry pull (`$CI_COMMIT_SHORT_SHA` 태그) |
| 컨테이너명 | `local-*` | `dev-*` / `prod-*` |
| DNS (compose 내부) | 짧은 서비스명 (`mysql`, `backend`) | 짧은 서비스명 동일 |
| nginx conf | `nginx.local.conf` | `nginx.dev.conf` / `nginx.prod.conf` |
| 자동 rollback | 없음 | 없음 (실패는 pipeline fail로 표면화) |

로컬과 CI는 compose 파일 구조(app/infra 분리)는 같고, env 소스와 이미지 획득 방식만 다름.

---

## 9. 자주 하는 질문

### Q. 두 파일을 한 번에 올릴 수는 없나?

A. 두 파일 모두 `name: s210-local`이므로 `-f -f`로 같이 지정 가능:

```bash
docker compose \
  -f infra/compose/docker-compose.infra-local.yml \
  -f infra/compose/docker-compose.app-local.yml \
  up -d --build
```

하지만 이 경우 backend가 mysql healthy 전에 기동되어 Flyway 오류가 날 수 있어 **2단계 순서 권장**.

### Q. app만 재시작하고 싶은데 infra가 영향받나?

A. 안 받음. `dca down && dca up -d --build`는 backend/ai/nginx만 내렸다 올림. infra 컨테이너/볼륨은 그대로.

### Q. 전체 초기화하려면?

A. 역순으로 down:

```bash
dca down        # app 먼저
dci down -v     # infra + 볼륨 모두
```

### Q. 새 환경변수 추가는?

A. env-sync 스킬 사용:

```
/env-sync add <KEY> <service>
```

스킬이 `infra/env/*.local.env.example` + `infra/env/README.md` + `docs/gitlab-variables.md` 전부 자동 업데이트.
