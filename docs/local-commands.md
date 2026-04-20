# 로컬 실행 명령어 치트시트

자주 쓰는 명령 복붙용. 상세 설명은 [local-dev.md](./local-dev.md) 참고.

> Git Bash 기준. repo root에서 실행 (`cd "$(git rev-parse --show-toplevel)"`).

---

## 0. 쉘 변수 세팅 (터미널 새로 열 때마다)

```bash
export ENV_DIR="$(cygpath -w "$(pwd)/infra/env")"
export COMPOSE_INFRA=infra/compose/docker-compose.infra-dev.yml
export COMPOSE_APP=infra/compose/docker-compose.app-dev.yml
```

---

## 1. 최초 셋업 (1회만)

```bash
# env 파일 복사 → 값 편집
cp infra/env/infra.dev.env.example infra/env/infra.dev.env
cp infra/env/app.dev.env.example   infra/env/app.dev.env
# (에디터로 infra/env/*.env 의 <secret> 부분 채우기)
```

---

## 2. 기동 (매일 시작할 때)

```bash
# Infra 먼저
docker compose --env-file infra/env/infra.dev.env -f "$COMPOSE_INFRA" -p s210-infra-dev up -d

# MySQL healthy 대기
until [ "$(docker inspect -f '{{.State.Health.Status}}' dev-mysql 2>/dev/null)" = "healthy" ]; do sleep 3; done
echo "mysql healthy"

# App (첫 빌드만 5~10분, 이후 캐시 사용)
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev up -d --build
```

---

## 3. 종료 (매일 끝낼 때 — 데이터 유지)

```bash
docker compose --env-file infra/env/app.dev.env   -f "$COMPOSE_APP"   -p s210-app-dev   down
docker compose --env-file infra/env/infra.dev.env -f "$COMPOSE_INFRA" -p s210-infra-dev down
```

---

## 4. 완전 초기화 (DB/MQ 볼륨까지 삭제)

```bash
docker compose --env-file infra/env/app.dev.env   -f "$COMPOSE_APP"   -p s210-app-dev   down -v
docker compose --env-file infra/env/infra.dev.env -f "$COMPOSE_INFRA" -p s210-infra-dev down -v
```

---

## 5. 개별 서비스 재빌드/재기동

```bash
# backend만
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev \
  up -d --build backend

# frontend(=nginx)만
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev \
  up -d --build nginx

# ai만
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev \
  up -d --build ai
```

---

## 6. 로그 보기

```bash
# 앱 전체 follow
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev logs -f

# 특정 서비스만
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev logs -f backend

# infra 쪽
docker compose --env-file infra/env/infra.dev.env -f "$COMPOSE_INFRA" -p s210-infra-dev logs -f
```

---

## 7. 상태 확인

```bash
# 전체 컨테이너
docker ps --filter "name=dev-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# HTTP 엔드포인트
curl http://localhost:3001/              # frontend
curl http://localhost:3001/api/health    # backend via nginx
curl http://localhost:3001/ai/health     # ai via nginx
curl http://localhost:8081/health        # backend direct
curl http://localhost:8001/health        # ai direct

# MySQL
docker exec -it dev-mysql mysql -uapp -papppass s210_dev

# Redis
docker exec dev-redis redis-cli ping

# RabbitMQ UI: http://localhost:15673  (rabbit / rabbitpass)
```

---

## 8. 자주 쓰는 한 줄

```bash
# 전체 재빌드 후 기동
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev up -d --build

# backend 로그 실시간 + 빠른 재기동
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev restart backend && \
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev logs -f backend

# 고스트 컨테이너 강제 청소
docker compose --env-file infra/env/app.dev.env -f "$COMPOSE_APP" -p s210-app-dev down --remove-orphans

# 볼륨 목록/용량
docker volume ls | grep s210
```

---

## 9. master 환경을 로컬에서도 돌려보고 싶을 때

compose 파일과 env만 master용으로 바꾸고 포트 충돌 주의:

```bash
export COMPOSE_INFRA=infra/compose/docker-compose.infra-master.yml
export COMPOSE_APP=infra/compose/docker-compose.app-master.yml

# env 파일도 master 버전 복사/편집
cp infra/env/infra.master.env.example infra/env/infra.master.env
cp infra/env/app.master.env.example   infra/env/app.master.env

docker compose --env-file infra/env/infra.master.env -f "$COMPOSE_INFRA" -p s210-infra-master up -d
docker compose --env-file infra/env/app.master.env   -f "$COMPOSE_APP"   -p s210-app-master   up -d --build
```

> master는 기본 포트(80, 3306, 6379, 5672)를 쓰므로 로컬의 다른 서비스와 충돌 가능. 이 경우 env에서 `FRONTEND_PORT`, `MYSQL_PORT` 등 override.
