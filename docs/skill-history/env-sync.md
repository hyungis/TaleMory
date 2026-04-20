# env-sync — Skill History

## v0.8 - 2026-04-20

- Summary: v0.7에서 도입한 `include:` 지시자를 폐기하고, 두 compose 파일(infra-local, app-local)이 **같은 `name: s210-local` 프로젝트를 공유하되 독립 파일**로 재편. 기동 워크플로는 `dci up -d` → mysql healthy 대기 → `dca up -d --build` 2단계. backend의 cross-file `depends_on` 제거 (compose validation 불가).
- Reason: v0.7의 `include:` 구조는 "infra를 먼저 올리고 나중에 app 추가" 워크플로에서 container_name 충돌을 유발했다 (infra-local.yml에 `name:`이 없어 standalone 기동 시 프로젝트명이 달라짐). 또한 사용자 의도는 "app이 infra에 의존(=infra 먼저 up)"에 가까운데, `include:`(=merge)는 의미상 더 강한 결합이었다. 이번 변경으로 두 스택의 lifecycle이 분리되고 의존 관계가 명시적이 됨.
- Changed files:
  - `infra/compose/docker-compose.infra-local.yml` — `name: s210-local` 추가, 주석 갱신 (기동 순서 명시)
  - `infra/compose/docker-compose.app-local.yml` — `include:` 제거, backend `depends_on` 제거, 상단 주석에 3단계 워크플로 명시
  - `docs/local-dev.md` — "2. 기동" 섹션을 2단계 워크플로로, alias를 `dci`/`dca`로 분리, FAQ/트러블슈팅 재작성
  - `docs/local-commands.md` — 전면 개편 (2-step 치트시트)
  - `.agents/skills/env-sync/SKILL.md` — 컨텍스트 문장에서 "include:" 제거, "2단계 기동" 명시
- Impact:
  - **"infra만 기동" 워크플로 정상 동작**: `dci up -d` 단독 실행 가능, DB/MQ만 필요한 테스트에 편리.
  - **app 재기동이 infra에 영향 없음**: `dca down && dca up -d --build`는 backend/ai/nginx만 재기동. mysql 데이터 보존.
  - **depends_on 손실**: backend의 `mysql: service_healthy` 게이트가 없으므로, 2단계 순서를 **사람이** 보장해야 함. Spring Boot / Flyway의 connection 재시도가 일부 완충.
  - **compose 경고 수용**: `dca up -d` 실행 시 `Found orphan containers ([local-mysql ...])` 경고가 뜨지만 정상 — compose가 범위 밖 서비스를 인식했으나 건드리지 않음. `--remove-orphans` 플래그 사용 금지.
- Validation (live smoke test 2026-04-20):
  - `dci up -d` → Network `s210-local_default` 생성, mysql/redis/rabbitmq 기동. mysql 10초 내 healthy.
  - `dca up -d --build` → backend/ai/nginx 생성, 같은 네트워크 attach. "Found orphan containers" 경고만 (정상).
  - `docker ps --filter "name=local-"` → 6/6 Up, mysql `(healthy)` 유지.
  - Backend Tomcat `Started in 8.613 seconds`, Flyway 오류 없음.
  - HTTP: frontend 200, backend 401 (Spring Security 기본), ai 200. 모두 기대대로.

### Amendment — backend template file 동기화 (v0.8.1)

라이브 검증 후, 사용자가 "왜 `application-example.yml`은 업데이트 안 했냐"고 지적. 재조사 결과:

- `app/backend/.gitignore`:
  ```
  application.yml
  !application-example.yml
  ```
  → `application.yml`은 gitignored, **tracked 템플릿은 `application-example.yml`** 하나.
- v0.6 단계에서 환경변수 기반으로 전환하며 `application.yml`만 수정하고 `application-example.yml`은 방치. 결과: 새 팀원이 `cp application-example.yml application.yml` 하면 redis/rabbitmq 블록 없이 시작 → backend 기동 실패.

#### 수정
- `app/backend/src/main/resources/application-example.yml` — 현재 `application.yml`과 동일 구조로 확장. default는 IDE 로컬 실행 기준(localhost + compose 호스트 포트 3307/6380/5673).
- `.agents/skills/env-sync/references/add-mode.md` — backend 힌트에 "application.yml + application-example.yml 둘 다 갱신 필수" 경고 추가.
- `.agents/skills/env-sync/references/check-mode.md` — scope mismatch 규칙에 "backend 키가 application-example.yml에 없으면 warning" 추가. 스캔 명령이 두 파일 모두 커버하는지 주석으로 명시.
- `.agents/skills/env-sync/references/service-mapping.md` — backend 행에 gitignore 주의사항 인라인, 파일 체크리스트 갱신.

#### 재발 방지
env-sync add 모드가 앞으로 backend 키 추가 시 **두 yml 파일 모두** 언급하도록 절차화. check 모드는 두 파일 사이 불일치를 warning으로 탐지.

### Amendment — Dockerfile이 application.yml auto-derive (v0.8.2)

v0.8.1 Amendment 후 "CI는 문제 없냐"는 질문으로 심층 조사. CI가 **잠재적으로 깨져 있었음**을 발견:

- `app/backend/.gitignore`가 `application.yml`을 제외 → CI git clone에는 없음.
- `build-backend.sh`의 `docker build` 시 `COPY src ./src`가 local `application-example.yml`만 포함.
- Spring Boot는 `application-example.yml`을 **profile="example"용 설정으로 해석**, `SPRING_PROFILES_ACTIVE=dev`에서는 로드 안 함.
- 결과: CI 컨테이너는 YAML 하나도 안 읽은 채 기동 → `${DB_URL}` 같은 env 참조가 바인딩 안 됨.
- 로컬은 dev가 수동으로 `cp application-example.yml application.yml` 했기 때문에 우연히 작동. CI는 그 스텝이 없었음.

v0.8.2 선택지 비교:
- **A** gitignore 풀고 `application.yml` 단일화 — 단순하지만 "secret 실수 방지" 안전망 포기.
- **B** `SPRING_CONFIG_LOCATION=classpath:/application-example.yml` env로 강제 — 규약 우회, 신참 혼란.
- **C** ⭐ Dockerfile에서 `cp -n` — **로컬/CI 모두 해결**, safety net(gitignore) 유지.

#### C 선택 이유 (초안 `cp -n`)
- 로컬 dev의 커스텀 `application.yml`은 `-n` (no-clobber)으로 보존
- CI clean-clone은 파일이 없으므로 `cp`가 example에서 derive
- 두 경로 모두 jar에 `application.yml` 포함 → Spring auto-load → env 바인딩 정상
- `application-example.yml`이 **유일한 tracked source of truth**로 명확해짐

#### 재검토 — `cp -n` → `cp -f` 변경 (v0.8.2 후속)

사용자 지적: "example도 같이 동기화 되게 해줘" — `-n`은 로컬 application.yml이 존재하면 skip이라 **example 업데이트가 전파 안 되는** 드리프트 구멍. 대칭 sync를 위해 `cp -f` (force overwrite)로 변경.

결과:
- `application-example.yml` = **유일하게 의미 있는 파일** (tracked)
- `application.yml` = build 시점 매번 example로 덮어써지는 derived artifact
- 로컬 application.yml 편집은 무의미 (다음 build에서 소실)
- 드리프트 원천 불가능 — bidirectional sync 고민 사라짐

Trade-off: IDE 밖에서 backend 실행(Docker 안 씀)하는 dev가 local application.yml을 커스터마이즈하려면 직접 example을 편집해야 함. 환경별 값은 env_file/env로 override하는 게 원래 설계라 문제 없음.

env-sync check 모드의 "application.yml에만 있는 키" 규칙은 warning → **error**로 승격 (Dockerfile이 즉시 지워버리므로 새 팀원을 위한 실질적 실수).

#### 수정
- `app/backend/Dockerfile` — `COPY src` 뒤에 `RUN cp -n src/main/resources/application-example.yml src/main/resources/application.yml` 한 줄 추가
- `.agents/skills/env-sync/references/add-mode.md` — "두 yml 모두 갱신" 경고를 "`application-example.yml`만 갱신하면 됨"으로 반전
- `.agents/skills/env-sync/references/check-mode.md` — 두 파일 관계 설명을 source/derived 로 갱신
- `.agents/skills/env-sync/references/service-mapping.md` — backend 행 문구 단순화

#### Validation (CI 시뮬레이션)
```
# 로컬 application.yml 임시 이동 (git clone 상태 재현)
mv src/main/resources/application.yml /tmp/bak
docker build --no-cache -t s210-backend:ci-test app/backend

# jar 내부 검증
unzip -l jar | grep application
# → BOOT-INF/classes/application-example.yml (729B)
# → BOOT-INF/classes/application.yml         (729B)   ← Dockerfile이 derive
```

두 파일 동일 바이트(729) → example에서 정확히 복제됨. Spring Boot가 `application.yml`을 auto-load → env 바인딩 정상화.

### Design Note — include: vs 공유 프로젝트명

| 항목 | v0.7 `include:` | v0.8 공유 `name:` |
|---|---|---|
| 단일 명령 기동 | ✅ `dca up -d` 하나 | ❌ 2단계 필수 |
| infra 단독 기동 | ⚠️ 가능하지만 이후 app 기동 시 충돌 | ✅ 깔끔 |
| cross-file `depends_on` | ✅ mysql healthy 게이트 | ❌ 사람이 확인 |
| lifecycle 분리 | ❌ app과 infra 묶임 | ✅ 독립 |
| 의도 표현 | "app이 infra를 포함" | "app이 infra에 의존" |

이번 repo는 로컬 개발에서 "infra를 자주 유지한 채 app만 재빌드"하는 패턴이 더 흔해서 v0.8 구조가 우위. depends_on 손실은 mysql healthy가 보통 10~30초 내 끝나고 Spring Boot가 hikari 기본 timeout(30s)을 가지므로 운영상 큰 문제 없음.

## v0.7 - 2026-04-20

- Summary: 루트 `.env` / `.env.example`을 완전히 제거하고, compose 병합을 `docker-compose.app-local.yml` 상단의 **`include:` 지시자 + `name: s210-local`** 로 전환. 로컬 엔트리 명령은 `docker compose -f infra/compose/docker-compose.app-local.yml up -d --build` (alias `dcl` 권장). v0.6의 "compose 메타만 담던 루트 .env"도 불필요해짐.
- Reason: 루트 `.env`가 남아 있으면 (a) compose가 자동 로드하는 "숨은 상태"가 되어 override 버그 유발, (b) Windows `COMPOSE_PATH_SEPARATOR` 이슈 지속, (c) 신규 팀원에게 "`.env`와 `infra/env/*.local.env` 둘 다 있네?"라는 혼동, (d) env-sync 스킬이 4개 소스를 유지해야 함. `include:`는 compose v2.20+ 표준이며 파일 자체에 구조 정보가 담겨 env 파일로부터 독립적.
- Changed files:
  - `.env` — 삭제 (untracked)
  - `.env.example` — 삭제 (tracked)
  - `infra/compose/docker-compose.app-local.yml` — 상단에 `name: s210-local` + `include: [docker-compose.infra-local.yml]` 추가
  - `infra/compose/docker-compose.infra-local.yml` — 주석 정리 (COMPOSE_FILE 언급 제거)
  - `.gitignore` — `!.env.example` 예외 라인 제거 (더 이상 tracked example 없음)
  - `docs/local-dev.md` — 1-1 (env 파일 2개 복사), 2 (기동 명령 `-f`), 7 (트러블슈팅), 9 (FAQ) 재작성
  - `docs/local-commands.md` — 전면 개편 (`dcl` alias 기반 치트시트)
  - `.agents/skills/env-sync/SKILL.md` — 컨텍스트 섹션 / 4개 소스 테이블 갱신
  - `.agents/skills/env-sync/references/add-mode.md` — Step 1 "루트 `.env.example`" → "로컬 env example 파일 (서비스별 분기)"로 전환
  - `.agents/skills/env-sync/references/check-mode.md` — 선언 소스 1을 `cat app.local.env.example infra.local.env.example`로 변경, scope-mismatch 추가 규칙
  - `.agents/skills/env-sync/references/service-mapping.md` — 루트 `.env` 언급 제거, 파일 위치 체크리스트 갱신
- Impact:
  - **세 번째 env 경로 완전 폐기**: 로컬 env는 이제 `infra/env/{app,infra}.local.env`만 존재.
  - **루트가 깔끔**: `.env.example` 없이 팀원 온보딩은 `infra/env/*.example` 복사만 하면 됨.
  - **include: 지시자의 프로젝트명 고정**: `name: s210-local`이 compose 파일에 인라인. `-p` 플래그 불필요.
  - **env-sync 소스 3종으로 축소**: app.local.env.example / infra.local.env.example / README.md. gitlab-variables.md는 자동 생성물.
- Follow-ups (none blocking):
  - 기존에 `cp .env.example .env` 절차를 외운 팀원 한 번 공지 필요.
  - `docs/ci-cd-pipeline-flow.md`의 "루트 `.env.example` 수정만으로는" 문구는 여전히 사실 (CI는 원래 .env.example을 보지 않음) 이므로 수정 불필요.

### Design Note — include: vs COMPOSE_FILE=A:B

두 방식 다 compose 병합을 구현하지만:

| 항목 | 루트 `.env`의 `COMPOSE_FILE=A:B` | compose 파일의 `include:` |
|---|---|---|
| 구조 선언 위치 | `.env` (runtime 설정) | compose yml (선언적) |
| `.env` 필요성 | 필수 | 불필요 |
| Windows path separator 이슈 | `;` vs `:` 문제 → `COMPOSE_PATH_SEPARATOR=:` 강제 필요 | 없음 (파일명만) |
| `-f` 플래그 | 불필요 (compose 자동 로드) | 엔트리 파일 하나만 `-f`로 지정 |
| 프로젝트명 | `COMPOSE_PROJECT_NAME` | 파일 상단 `name:` |
| compose v2 최소 버전 | 모든 버전 | v2.20+ |

이번 repo의 compose 버전은 v5.1.0이므로 `include:` 사용에 제약 없음. 선언적 배치가 `.env` 의존성을 끊어낸다.

## v0.6 - 2026-04-20

- Summary: 로컬 env 파일을 루트 단일 `.env`에서 **`infra/env/app.local.env` + `infra/env/infra.local.env`** 2-파일 구조로 분리. 루트 `.env`는 compose 제어 메타(`COMPOSE_FILE`/`COMPOSE_PROJECT_NAME`/`COMPOSE_PATH_SEPARATOR` + 선택적 포트 override)만 담당. compose는 `env_file: ../env/*.local.env`로 각 컨테이너에 주입.
- Reason: v0.5에서 로컬 compose는 CI와 동일한 app/infra 분리 구조를 갖췄지만, env 파일은 여전히 루트 `.env` 단일 파일이었다. 결과적으로 "compose는 분리, env는 합침"이라는 비대칭. CI는 `app.dev.env` + `infra.dev.env`로 분리돼 있는데 로컬만 flat이니 env-sync가 2개의 다른 패턴을 유지해야 했다. 이번 변경으로 로컬/CI가 **컴포즈 파일 분리 + env 파일 분리**라는 대칭 구조로 완전히 통일됐다.
- Changed files:
  - `infra/env/app.local.env.example` — 신규 (backend/ai env)
  - `infra/env/infra.local.env.example` — 신규 (mysql/redis/rabbitmq env)
  - `infra/env/app.local.env` — 신규 (gitignored 실 값, example 복사)
  - `infra/env/infra.local.env` — 신규 (gitignored)
  - `.env.example` — compose 메타만 남기도록 슬림화
  - `.gitignore` — `infra/env/*.env` 규칙 재추가 (`*.example` 제외)
  - `infra/compose/docker-compose.infra-local.yml` — `env_file: ../env/infra.local.env`, redis는 `sh -c 'redis-server --requirepass "$$REDIS_PASSWORD"'` 래퍼
  - `infra/compose/docker-compose.app-local.yml` — `env_file: ../env/app.local.env`
  - `docs/local-dev.md`, `docs/local-commands.md` — 3-파일 복사 안내
  - `.agents/skills/env-sync/references/service-mapping.md` — 로컬 선언 소스 경로 업데이트
  - `docs/skill-history/env-sync.md` (이 항목)
- User approval: Approved
- Impact:
  - **로컬/CI env 파일 구조 완전 대칭**: `infra/env/<app|infra>.<local|dev|master>.env.example` 6개 파일이 `infra/compose/docker-compose.<app|infra>-<local|dev|master>.yml` 6개 파일과 1:1 매칭.
  - **env-sync 스캔 소스 단순화**: 이전엔 루트 `.env.example` + `infra/env/README.md` 2종이 로컬 키를 분담했는데, 이제 로컬 키는 `infra/env/*.local.env.example` 2개에만 존재. README는 CI-only 카탈로그로 전념.
  - **Redis 비밀번호 처리**: compose 치환 대신 `sh -c` 래퍼로 컨테이너 env에서 읽음. 루트 `.env`와 `infra/env/infra.local.env` 간 비밀번호 중복이 사라짐.
  - **사용자 명령 UX 유지**: `docker compose up -d --build` 한 줄. 초기 셋업만 `.env` + `app.local.env` + `infra.local.env` 3개 복사.

### Design Note — Redis에 sh -c 래퍼를 쓴 이유

alternatives:

1. **`--requirepass ${REDIS_PASSWORD}` compose 치환**: `${REDIS_PASSWORD}`는 compose 치환 컨텍스트(루트 .env나 --env-file)에서만 해결됨. env_file 기반으로 password를 infra.local.env에 두면 치환 불가 → 루트 .env에도 중복 저장해야 함.
2. **redis.conf 파일 mount**: conf 안에서 env 치환 불가. envsubst로 빌드 시점에 생성해야 함. 복잡.
3. **✅ `sh -c 'redis-server --requirepass "$$REDIS_PASSWORD"'`**: `$$`는 compose가 `$`로 치환, 이후 sh가 컨테이너 env(env_file에서 주입된)에서 REDIS_PASSWORD 확장. 중복 없음, 추가 파일 없음.

선택된 3번은 "env_file이 유일한 source of truth"라는 원칙을 지키면서 compose 자체 문법으로 해결.

### Design Note — 루트 .env에 COMPOSE_PATH_SEPARATOR=: 고정

Windows docker의 기본 `COMPOSE_FILE` 구분자는 `;`, Linux/macOS는 `:`. 팀원 OS 혼재 가능성을 고려해 `.env`에 `COMPOSE_PATH_SEPARATOR=:`를 명시해 **모든 OS에서 `:` 강제**. docs 예시도 모두 `:` 기준으로 통일.

## v0.5 - 2026-04-20

- Summary: v0.4에서 도입한 "루트 단일 `docker-compose.yml`" 전략을 폐기하고, 로컬 compose도 CI/운영과 같은 app/infra 분리 구조(`infra/compose/docker-compose.{app,infra}-local.yml`)로 재정렬했다. 루트 `.env`의 `COMPOSE_FILE` 변수가 두 파일을 암묵적으로 merge해서 UX는 그대로 `docker compose up -d --build` 한 줄.
- Reason: v0.4는 로컬 UX에만 최적화했는데, 그 결과 `infra/compose/`의 dev/master 파일과 루트 `docker-compose.yml`이 **구조적으로 서로 다른 패턴**을 갖게 됐다. 팀이 "로컬에서 만든 구조"와 "CI에서 돌아가는 구조"를 머릿속에서 2벌 유지해야 하는 부담. 사용자 요청으로 로컬도 같은 app/infra 분리 패턴을 강제해 한 벌의 정신 모형으로 통일.
- Changed files:
  - `docker-compose.yml` (루트) — 삭제
  - `infra/compose/docker-compose.infra-local.yml` — 신규 (mysql/redis/rabbitmq)
  - `infra/compose/docker-compose.app-local.yml` — 신규 (backend/ai/nginx, depends_on으로 mysql health 대기)
  - `.env.example` — `COMPOSE_FILE`, `COMPOSE_PROJECT_NAME` 추가
  - `docs/local-dev.md`, `docs/local-commands.md` — 분리 구조 설명으로 재작성
  - `.agents/skills/env-sync/references/service-mapping.md` — 로컬 compose 경로를 `infra/compose/*-local.yml`로 갱신
  - `docs/skill-history/env-sync.md` (이 항목)
- User approval: Approved
- Impact:
  - **사용자 명령 UX 동일** — `docker compose up -d --build` 여전히 한 줄. `.env`의 `COMPOSE_FILE=A:B`가 compose의 multi-file merge를 자동 트리거.
  - **구조적 일관성 확보** — 로컬/dev/master가 모두 `infra/compose/docker-compose.{app,infra}-<env>.yml` 네이밍. 새 환경(예: staging) 추가도 같은 패턴으로 확장.
  - **app/infra 개별 기동 가능** — `COMPOSE_FILE`을 임시 override하면 infra만 또는 app만 기동 가능.
  - **컨테이너명 접두사 추가** — 로컬 서비스는 `local-*`로 컨테이너명이 붙어 `dev-*`/`prod-*`와 동시 실행 가능.

### Design Note — COMPOSE_FILE로 merge를 선택한 이유

두 compose 파일을 로컬에서 합치는 방법 비교:

1. **명시적 `-f -f`** — 모든 명령에 `-f infra/compose/... -f infra/compose/... -p s210-local` 반복. UX 악화.
2. **Makefile/스크립트 래퍼** — `make up` 같은 새 명령 도입. 팀에 추가 관습 부담.
3. **`.env`의 `COMPOSE_FILE` 환경변수** — compose가 자동 인식. 명령 UX가 `docker compose up -d --build` 그대로.

선택: 3번. 신규 도구 도입 없이 compose 자체 기능만으로 해결. `.env`에 한 줄 추가되는 것이 유일한 비용.

### Design Note — 로컬 컨테이너명에 `local-` 접두사 부여

dev/master 패턴(`dev-*`, `prod-*`)과 **시각적으로 구분**하기 위해 `local-mysql`, `local-backend` 등 접두사를 붙임. 장점:

- `docker ps`에서 환경 즉시 식별 가능
- dev/master 컨테이너가 동시에 떠 있어도 혼동·충돌 없음 (같은 머신에서 CI/로컬 병행 가능성)
- nginx 프록시는 compose DNS(짧은 서비스명 `backend`, `ai`)로 해결 — 컨테이너명과 독립

단점: `docker exec` 시 `local-mysql` 타이핑이 길음. 대안으로 `.bashrc`에 alias 권장 가능.

## v0.4 - 2026-04-20

- Summary: 로컬 개발을 루트 `docker-compose.yml` + `.env` 단일 조합으로 전환한 프로젝트 리팩터링에 맞춰 env-sync 스킬을 확장했다. 선언 소스를 `infra/env/*.env.example` 4종에서 **루트 `.env.example` + `infra/env/README.md` 테이블** 2종으로 재편하고, 세 번째 모드 `gitlab-vars`를 추가해 `docs/gitlab-variables.md`를 자동 생성한다.
- Reason: v0.3까지의 env-sync는 `infra/env/*.env.example` 4개를 grep 대상으로 삼았는데, 이 파일들이 로컬/CI 모두에서 실 runtime에 사용되지 않는 순수 문서 상태였고, 로컬 compose 단순화 작업(`docker-compose.yml` 루트화)에서 완전히 삭제됐다. 그 결과 check / add 모드가 참조할 소스가 사라져 스킬 업데이트가 필수였다. 동시에 GitLab Variables 등록 체크리스트를 수동 관리하는 불편을 해소하기 위해 `gitlab-vars` 모드를 신설했다.
- Changed files:
  - `.agents/skills/env-sync/SKILL.md` (3-mode 구조로 재구성, 트리거 문구 확장)
  - `.agents/skills/env-sync/references/add-mode.md` (업데이트 대상: 루트 `.env.example` + `infra/env/README.md` + `docs/gitlab-variables.md`)
  - `.agents/skills/env-sync/references/check-mode.md` (스캔 소스: 루트 `.env.example` + README 테이블 파싱)
  - `.agents/skills/env-sync/references/service-mapping.md` (로컬/CI 분리 매트릭스 명시, 파일 경로 체크리스트 추가)
  - `.agents/skills/env-sync/references/gitlab-vars-mode.md` (신규)
  - `docs/gitlab-variables.md` (신규, 초기 체크리스트 수동 시드)
  - `docs/skill-history/env-sync.md` (이 항목)
- User approval: Approved
- Impact: add 모드는 서비스 코드 자동 편집을 여전히 금지하면서 "하나의 선언을 두 위치에 동기"하도록 구조화됐다 — 로컬은 루트 `.env.example`, CI는 `infra/env/README.md`. 체크리스트 `docs/gitlab-variables.md`는 재생성 대상이지만 기존 체크박스 상태는 최대한 보존해 팀 진행 현황판으로 기능한다. 이번 변경으로 "`.env.example` 4개를 수동 동기화"해야 했던 드리프트 지점이 사라지고, 단일 README 테이블이 CI 변수의 유일한 원천이 된다.

### Design Note — gitlab-vars를 새 모드로 분리한 이유

rejected 대안:

1. **add 모드 안에서 항상 체크리스트 재생성.** 코드 참조 분석이 필요해 체크 모드와 겹치고, add만 돌 때는 불필요한 비용. 분리가 단일 책임 원칙에 맞음.
2. **check 모드의 flag(`--export-gitlab-vars`)로 병합.** check는 read-only가 원칙인데 파일을 쓰면 원칙 위반. 명시적 모드가 깔끔.

선택된 구조: 세 모드가 각자 한 역할만 담당. `/env-sync gitlab-vars`를 치면 체크리스트만 재생성, 나머지는 건드리지 않음.

### Design Note — 체크박스 보존 로직

`docs/gitlab-variables.md`가 이미 존재할 때 재생성 규칙:

1. 기존 파일에서 `- [x] `<NAME>`` 패턴으로 체크된 키 이름 집합을 추출
2. 재계산된 키 목록과 교집합 → 해당 키들만 `- [x]` 유지, 새 키는 `- [ ]`
3. 재계산에서 사라진 키는 체크박스째 제거 (GitLab에 등록된 것과 무관)

의미: "파일 체크박스 = 누군가가 GitLab에 등록했다고 선언한 상태". 재생성이 이 선언을 의미 없이 되돌리지 않음.

## v0.3 - 2026-04-20

- Summary: Added `app/ai/.claude/` workspace config (`settings.json` + `load-skill.py`) so env-sync also auto-loads when Claude is invoked from `app/ai/` as CWD. The AI workspace currently has no native skill, so `NATIVE_SKILL = None` and only `EXTRA_MAP` fires.
- Reason: v0.2 closed the gap for `app/backend` and `app/frontend`, but `app/ai` had no `.claude/` workspace at all — any env-var work from there had zero skill context. Teammates doing FastAPI/Python work on `app/ai/` would miss env-sync's procedure entirely.
- Changed files:
  - `app/ai/.claude/settings.json` (new — mirrors backend/frontend wiring)
  - `app/ai/.claude/hooks/load-skill.py` (new — same `NATIVE_SKILL` + `EXTRA_MAP` shape, `NATIVE_SKILL = None`)
  - `docs/skill-history/env-sync.md` (this entry)
- User approval: Approved
- Impact: env-sync now auto-loads from all four workspaces (repo root, `app/backend`, `app/frontend`, `app/ai`) whenever a file under `infra/env/` is edited. When a dedicated AI skill is introduced later, swapping `NATIVE_SKILL = None` for the new skill name is the only change needed.

### Design Note — Nullable NATIVE_SKILL

Chosen over two alternatives:

1. **Skip creating `app/ai/.claude/` entirely.** Leaves the gap that triggered this update. Rejected.
2. **Create a placeholder AI skill (e.g. `python-fastapi-patterns`) now.** Premature — no stable conventions captured yet, and `managing-skill-evolution` requires explicit user approval to register new managed skills. Rejected.

`NATIVE_SKILL = None` keeps the hook structurally identical to the backend/frontend hooks (same file shape, same sentinel logic) so a future AI skill becomes a one-line swap rather than a restructure.

## v0.2 - 2026-04-20

- Summary: Extended sub-root hook scripts (`app/backend/.claude/hooks/load-skill.py`, `app/frontend/.claude/hooks/load-skill.py`) to auto-load `env-sync` when the `Edit|Write` target is under `infra/env/`, keeping the existing native skill (kotlin-ddd / storybook) loading unchanged.
- Reason: In v0.1 only the root-level `SKILL_MAP` triggered `env-sync`. If a teammate opened Claude from `app/backend/` or `app/frontend/` as CWD (which is common during feature work), the workspace-specific hook only loaded its native skill, so env-var tasks from those workspaces ran without the env-sync procedure in context. This gap meant env-sync's discipline (update `.env.example` + README + print GitLab Variables checklist; do not auto-edit service code) was skipped unless the user manually invoked the skill.
- Changed files:
  - `app/backend/.claude/hooks/load-skill.py` (rewritten with `NATIVE_SKILL` + `EXTRA_MAP` pattern)
  - `app/frontend/.claude/hooks/load-skill.py` (same pattern)
  - `docs/skill-history/env-sync.md` (this entry)
- User approval: Approved
- Impact: env-sync now auto-loads from any of three workspaces (repo root / `app/backend` / `app/frontend`) whenever a file under `infra/env/` is edited, within the same session-scoped sentinel guarantee (each skill injected at most once per session). `app/ai` still has no `.claude/` workspace config — env-var tasks from that directory require running Claude from repo root instead. The new sub-root hook structure is extensible: additional conditional skills can be added by appending entries to `EXTRA_MAP` in each sub-root hook.

### Design Note — why EXTRA_MAP pattern

Rejected alternatives:

1. **Always load env-sync in sub-root hooks (unconditional).** Wasteful — loads env-sync context even when the user is only editing app code. Context budget matters.
2. **Move all logic into a single shared library imported by every hook.** Cleaner but adds indirection; the project convention is standalone per-workspace hook scripts.
3. **Have the sub-root hook shell out to the root hook as a secondary invocation.** Fragile — hooks consume stdin and combining their stdout is not how the hook API is designed.

Chosen: in-script `EXTRA_MAP` per workspace. Small code duplication (~5 lines), no new inter-hook coupling, preserves existing "native skill always, extras on demand" intent.

## v0.1 - 2026-04-20

- Summary: Initial creation of the `env-sync` skill to automate environment-variable propagation and consistency audit across frontend, backend, ai, and infra.
- Reason: Environment variables are spread across four axes in S210 (React frontend, Spring backend, Python ai, Docker compose infra). Manual edits repeatedly cause:
  - missing keys in `.env.example` files → service fails in CI
  - code references without compose injection → runtime errors (recently observed as Flyway "Communications link failure" when `application.yml` used hardcoded values instead of `${DB_URL}`)
  - orphan keys in `.env.example` that nothing reads
  - divergence between GitLab CI/CD Variables and example files
- Changed files:
  - `.agents/skills/env-sync/SKILL.md`
  - `.agents/skills/env-sync/references/add-mode.md`
  - `.agents/skills/env-sync/references/check-mode.md`
  - `.agents/skills/env-sync/references/service-mapping.md`
  - `.agents/skills/env-sync/references/whitelist.md`
  - `.claude/hooks/load-project-skills.py` (added `/infra/env/` → `env-sync` to `SKILL_MAP`)
  - `.agents/skills/managing-skill-evolution/SKILL.md` (added `env-sync` to Managed Scope — Protected Area change)
  - `.agents/skills/managing-skill-evolution/references/managed-skills.md` (registered with path + history)
  - `docs/skill-history/env-sync.md` (this file)
- User approval: Approved
- Impact: Future env-variable work follows one of two auto-loaded flows. `add` mode updates `.env.example` + README + outputs a GitLab Variables checklist without touching service code. `check` mode audits code ↔ example drift and reports missing/orphan/scope issues. Service code (`application.yml`, React src/, Python app/) is intentionally NOT auto-edited — ownership stays with each service team. The hook auto-injects the skill when any `infra/env/` file is edited.

## Design Notes

These decisions are intentional and should not change without a new history entry:

- **Two modes (`add`, `check`) instead of one unified flow.** Add is write-oriented with clear side effects; check is read-only audit. Mixing them in one mode obscures which operations mutate state.
- **CWD independence via `git rev-parse --show-toplevel`.** The skill may be invoked from `app/backend`, `app/frontend`, `app/ai`, or repo root. Relative paths are forbidden in the skill's own logic.
- **Whitelist is externalized** to `references/whitelist.md` so adding new container images (e.g. Elasticsearch) doesn't require editing the skill's core logic — only the whitelist data file.
- **Single SKILL_MAP entry** (`/infra/env/` → env-sync). Not `/app/backend/` or `/app/frontend/` because those are claimed by their own skills and the hook takes first match only. If users want env-sync proactively from those paths, they invoke it explicitly.

## Known Limitations

- Scope-mismatch detection is MVP only (backend/frontend/ai code vs app/infra example files). It does not cross-validate dev vs master environment drift.
- Auto-fix scope is bounded to `.env.example` + `infra/env/README.md`. Service code edits remain manual by design.
- Python AI scan pattern (`os.getenv`, `os.environ`) may miss custom wrappers. Extend `references/check-mode.md` grep patterns if a wrapper is introduced.
