# 로컬 개발 실행 가이드

S210 인프라/앱 스택을 개발 PC에서 띄우는 순서. GitLab CI 없이 `docker compose` 직접 호출.

> CI 배포 서버는 `/tmp/env/`를 쓰지만 로컬은 `infra/env/`로 통일. `.gitignore` 덕분에 실 env 파일은 커밋되지 않음.

---

## 0. 전제 조건

- **Docker Desktop** 실행 중 (`docker ps`에 에러 없이 헤더 나와야 함)
- **Git Bash** 사용 (repo의 모든 bash 스크립트가 전제). PowerShell은 문법이 달라 비권장
- repo 루트에서 명령 실행 (`C:/Users/SSAFY/gibeom/S210/S14P31S210`)

---

## 1. env 파일 준비 (최초 1회)

### 1-1. 예시 복사

```bash
cd "$(git rev-parse --show-toplevel)"

cp infra/env/infra.dev.env.example infra/env/infra.dev.env
cp infra/env/app.dev.env.example   infra/env/app.dev.env
```

생성된 파일은 `.gitignore`에 의해 자동으로 커밋 대상에서 제외됩니다.

### 1-2. `infra/env/infra.dev.env` 채우기

`<secret>` 자리에 로컬 더미값 채움:

```dotenv
COMPOSE_PROJECT_NAME=s210-infra-dev

MYSQL_ROOT_PASSWORD=rootpass
MYSQL_DATABASE=s210_dev
MYSQL_USER=app
MYSQL_PASSWORD=apppass
MYSQL_PORT=3307

REDIS_PORT=6380

RABBITMQ_DEFAULT_USER=rabbit
RABBITMQ_DEFAULT_PASS=rabbitpass
RABBITMQ_PORT=5673
RABBITMQ_MANAGEMENT_PORT=15673
```

### 1-3. `infra/env/app.dev.env` 채우기

⚠️ **중요**: `DB_USERNAME/DB_PASSWORD`와 `RABBITMQ_USERNAME/PASSWORD`는 `infra.dev.env`의 값과 반드시 일치.

```dotenv
COMPOSE_PROJECT_NAME=s210-app-dev

# Backend
SPRING_PROFILES_ACTIVE=dev
SERVER_PORT=8080
DB_URL=jdbc:mysql://dev-mysql:3306/s210_dev?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
DB_USERNAME=app
DB_PASSWORD=apppass          # ← infra의 MYSQL_PASSWORD와 동일

# Redis
REDIS_HOST=dev-redis
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_HOST=dev-rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=rabbit        # ← infra의 RABBITMQ_DEFAULT_USER
RABBITMQ_PASSWORD=rabbitpass    # ← infra의 RABBITMQ_DEFAULT_PASS

# Frontend (nginx publish port)
FRONTEND_PORT=3001
VITE_API_BASE_URL=/api

# AI
OPENAI_API_KEY=sk-dummy-local
```

---

## 2. 환경변수 헬퍼

로컬에선 compose가 `${ENV_DIR:-/tmp/env}/...`를 참조하므로 `ENV_DIR`을 `infra/env/`의 **Windows 절대경로**로 넘겨야 합니다. 매번 치기 귀찮으니 쉘 변수로:

```bash
export ENV_DIR="$(cygpath -w "$(pwd)/infra/env")"
export COMPOSE_APP=infra/compose/docker-compose.app-dev.yml
export COMPOSE_INFRA=infra/compose/docker-compose.infra-dev.yml
```

(새 터미널 열 때마다 다시 `export` 필요. `~/.bashrc`에 넣어두거나 아래 명령들에 인라인으로 박아도 됨.)

---

## 3. Infra 스택 기동 (MySQL/Redis/RabbitMQ)

App보다 **먼저** 떠 있어야 합니다 — app 쪽이 `dev-s210-infra-net`을 external로 참조하기 때문.

```bash
docker compose \
  --env-file infra/env/infra.dev.env \
  -f "$COMPOSE_INFRA" \
  -p s210-infra-dev \
  up -d
```

결과 확인:

```bash
docker ps --filter "name=dev-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

기대 출력: `dev-mysql`, `dev-redis`, `dev-rabbitmq` 3개. MySQL은 `(health: starting)` → 15~30초 후 `(healthy)`로 바뀜.

---

## 4. App 스택 기동 (nginx + backend + ai)

registry에 이미지가 없으므로 `--build` 필수:

```bash
docker compose \
  --env-file infra/env/app.dev.env \
  -f "$COMPOSE_APP" \
  -p s210-app-dev \
  up -d --build
```

⏱ **첫 빌드는 5~10분** 걸립니다:

- frontend: `pnpm install` + `vite build` + nginx 이미지
- backend: `./gradlew build`
- ai: `pip install -r requirements.txt`

이후 소스 변경 시 해당 서비스만 다시 빌드:

```bash
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev \
  up -d --build backend
```

---

## 5. 동작 확인

### 5-1. 컨테이너 상태

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

기대: 6개 모두 Up (`dev-nginx`, `dev-backend`, `dev-ai`, `dev-mysql`, `dev-redis`, `dev-rabbitmq`).

### 5-2. HTTP 엔드포인트

```bash
curl http://localhost:3001/              # frontend 정적 파일
curl http://localhost:3001/api/health    # nginx → backend
curl http://localhost:3001/ai/health     # nginx → ai

# backend / ai 직접 (publish된 포트)
curl http://localhost:8081/health        # dev-backend
curl http://localhost:8001/health        # dev-ai
```

### 5-3. DB 접속

```bash
docker exec -it dev-mysql mysql -uapp -papppass s210_dev
```

### 5-4. RabbitMQ 관리 UI

브라우저: http://localhost:15673 (ID: `rabbit` / PW: `rabbitpass`)

---

## 6. 로그 보기

```bash
# 앱 쪽 전체
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev logs -f

# 특정 서비스
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev logs -f backend
```

---

## 7. 정리

### 7-1. 컨테이너만 내리기 (데이터 보존)

```bash
docker compose --env-file infra/env/app.dev.env   -f "$COMPOSE_APP"   -p s210-app-dev   down
docker compose --env-file infra/env/infra.dev.env -f "$COMPOSE_INFRA" -p s210-infra-dev down
```

### 7-2. 볼륨까지 삭제 (MySQL/Redis/RabbitMQ 데이터 초기화)

```bash
docker compose --env-file infra/env/infra.dev.env -f "$COMPOSE_INFRA" -p s210-infra-dev down -v
```

---

## 8. 포트 요약 (로컬)

| 서비스 | 컨테이너명 | 호스트 포트 | 내부 포트 |
|---|---|---|---|
| frontend (nginx) | `dev-nginx` | **3001** | 80 |
| backend | `dev-backend` | 8081 | 8080 |
| ai | `dev-ai` | 8001 | 8000 |
| mysql | `dev-mysql` | 3307 | 3306 |
| redis | `dev-redis` | 6380 | 6379 |
| rabbitmq (AMQP) | `dev-rabbitmq` | 5673 | 5672 |
| rabbitmq (UI) | `dev-rabbitmq` | 15673 | 15672 |

외부 진입점은 **`http://localhost:3001`** 하나.

---

## 9. 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| `invalid reference format` | `REGISTRY` 비어있을 때 compose가 잘못된 태그 생성. compose 파일 이미 `${REGISTRY:+...}`로 수정됨. 최신 pull 확인 |
| `env file ... not found` | `ENV_DIR` 미지정 또는 오타. `echo $ENV_DIR` 확인 후 `cygpath` 재실행 |
| `network dev-s210-infra-net not found` | infra 스택이 안 떠 있음. 3번 먼저 실행 |
| `port is already allocated` | 3001/8081/3307 등 호스트 포트 충돌. `docker ps` 로 점유 컨테이너 찾아서 내림 |
| backend가 `Communications link failure` | MySQL healthy 전에 backend가 연결 시도. `restart: unless-stopped`라 곧 재시도 성공. 첫 기동 때만 보임 |
| `pnpm install` 에러 | `app/frontend/pnpm-lock.yaml` 있는지 확인. 없으면 먼저 `cd app/frontend && pnpm install` 한 번 |
| Flyway migration 실패 | `app/backend/src/main/resources/db/migration/Vn__*.sql` 확인. 이미 적용된 V 파일을 수정했으면 DB 초기화(`down -v`) 필요 |
| 한 서비스만 다시 빌드 | `docker compose ... up -d --build <svc>` |

---

## 10. 서버 배포(CI)와 다른 점

| | 로컬 | 서버 (GitLab CI) |
|---|---|---|
| env 위치 | `infra/env/*.env` | `/tmp/env/*.env` (generate-env.sh 생성) |
| env 소스 | 직접 작성 | GitLab CI/CD Variables |
| 이미지 | `docker compose --build` 로 로컬 빌드 | registry pull |
| tag | `latest` | `$CI_COMMIT_SHORT_SHA` |
| 실행 | `docker compose` 직접 | `infra/scripts/deploy-dev.sh` 경유 (rollback trap 포함) |

로컬은 CI와 동일한 compose 파일을 쓰되 env 소스와 이미지 획득 방식만 다르다고 생각하면 됩니다.
