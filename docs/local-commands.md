# 로컬 실행 명령어 치트시트

`infra/compose/docker-compose.{app,infra}-local.yml` 기반. 상세는 [local-dev.md](./local-dev.md).

> repo 루트에서 실행: `cd "$(git rev-parse --show-toplevel)"`
>
> 두 compose 파일 모두 `name: s210-local`로 **같은 프로젝트/네트워크**를 공유. 기동은 **infra → app** 2단계 순서 필수. 루트 `.env` 미사용.
>
> alias 권장 (한 번만 등록):
> ```bash
> alias dci='docker compose -f infra/compose/docker-compose.infra-local.yml'
> alias dca='docker compose -f infra/compose/docker-compose.app-local.yml'
> ```

---

## 0. 최초 1회

```bash
cp infra/env/app.local.env.example   infra/env/app.local.env
cp infra/env/infra.local.env.example infra/env/infra.local.env
# (infra/env/app.local.env 편집 — OPENAI_API_KEY 등 필요 시)
# 비밀번호는 app.local.env / infra.local.env 간 반드시 일치 유지.
```

루트 `.env`는 **만들지 않는다**.

---

## 1. 기동 (2단계 — 순서 중요)

```bash
# 1) infra 먼저
dci up -d

# 2) mysql healthy 확인 (20~30초)
dci ps     # mysql이 "Up (healthy)" 될 때까지

# 3) app 기동 (첫 빌드 5~10분)
dca up -d --build
```

기동 중 compose가 `Found orphan containers ([local-mysql ...])` 경고를 띄우는데 **정상**이다 — app-local.yml 범위 밖의 infra 컨테이너를 인식했지만 건드리지 않음.

---

## 2. 상태 확인

```bash
# 프로젝트 전체
docker ps --filter "name=local-"

# 파일별
dci ps
dca ps

# HTTP 체크
curl http://localhost:3001/              # frontend nginx → 200
curl http://localhost:3001/api/          # backend via nginx → 401 (Spring Security)
curl http://localhost:3001/ai/           # ai via nginx → 200
curl http://localhost:8081/              # backend 직접 → 401
curl http://localhost:8001/              # ai 직접 → 200

# DB / Cache / MQ
docker exec -it local-mysql mysql -uapp -papppass iportfolio
docker exec local-redis redis-cli -a redispass ping
# RabbitMQ UI: http://localhost:15673  (rabbit / rabbitpass)
```

---

## 3. 종료

### app만 (infra 유지)
```bash
dca down
```

### infra만
```bash
# app이 아직 떠 있으면 먼저 종료
dca down
dci down          # 데이터 유지
dci down -v       # 볼륨까지 삭제 (DB/MQ/cache 초기화)
```

### 전체
```bash
dca down && dci down       # 데이터 유지
dca down && dci down -v    # 완전 초기화
```

---

## 4. 개별 서비스 제어

```bash
# app 스택 재빌드
dca up -d --build backend
dca up -d --build nginx
dca up -d --build ai

# infra 재시작
dci restart mysql
dci restart redis

# 중지 (컨테이너 유지)
dca stop backend

# 다시 시작
dca start backend
```

---

## 5. 로그

```bash
# app 전체
dca logs -f

# 특정 서비스
dca logs -f backend
dca logs --tail=200 backend

# infra
dci logs -f mysql redis rabbitmq
```

---

## 6. 컨테이너 쉘 접속

```bash
docker exec -it local-backend sh
docker exec -it local-mysql bash
docker exec -it local-redis sh
```

---

## 7. 자주 쓰는 한 줄

```bash
# backend만 재빌드 + 로그 follow
dca up -d --build backend && dca logs -f backend

# 프로젝트 볼륨 목록
docker volume ls | grep s210-local

# 프로젝트 컨테이너만
docker ps --filter "name=local-"

# mysql healthy 즉시 판정
docker inspect --format='{{.State.Health.Status}}' local-mysql
```

---

## 8. infra만 기동 (DB 검증용)

```bash
dci up -d
# app 없이 mysql/redis/rabbitmq만 올라옴
# 호스트에서 직접 접근:
#   mysql:     localhost:3307  (user=app, pw=apppass, db=iportfolio)
#   redis:     localhost:6380  (pw=redispass)
#   rabbitmq:  localhost:5673 / UI localhost:15673
```

나중에 app 추가:
```bash
dca up -d --build
```

---

## 9. alias 없이 한 번에 올리기

2단계 순서를 건너뛰고 한 명령으로 기동 가능하나 **backend Flyway 실패 위험** (mysql healthy 전에 backend 시작):

```bash
docker compose \
  -f infra/compose/docker-compose.infra-local.yml \
  -f infra/compose/docker-compose.app-local.yml \
  up -d --build
```

기본은 **2단계 순차** 권장.

---

## 10. 빌드 캐시 문제 해결

```bash
docker builder prune -af
docker system prune -af
```

---

## 11. MySQL 볼륨 초기화 (DB 이름 변경 등)

```bash
dca down
dci down -v
dci up -d && dci ps   # mysql healthy 대기
dca up -d --build
```

---

## 12. PowerShell 사용자 참고

alias 대신 Function:

```powershell
function dci { docker compose -f infra/compose/docker-compose.infra-local.yml $args }
function dca { docker compose -f infra/compose/docker-compose.app-local.yml $args }
```

멀티라인은 백틱(`` ` ``). interactive는 Git Bash 권장.

---

## 13. CI 배포와의 명령 비교

| 작업 | 로컬 | CI 시뮬레이션 (서버 SSH) |
|---|---|---|
| infra 기동 | `dci up -d` | `bash infra/scripts/deploy-infra-dev.sh` |
| app 기동 | `dca up -d --build` | `bash infra/scripts/deploy-dev.sh all` |
| 롤백 | 수동 (이전 이미지 태그 필요) | GitLab pipeline `APP_IMAGE_TAG=<prev_sha>` override 재실행 또는 `git revert`|
| env 생성 | 없음 (수동 `infra/env/*.local.env`) | `bash infra/scripts/generate-env.sh dev` |

로컬 compose(`*-local.yml`)와 CI compose(`*-dev.yml`/`*-master.yml`)는 별도 관리.
