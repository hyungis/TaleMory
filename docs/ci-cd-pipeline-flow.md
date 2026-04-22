# CI/CD 파이프라인 흐름도

> 팀 Git 컨벤션과 실제 프로젝트 구조(MySQL + RabbitMQ + Redis, 3개 앱 서비스)를 기준으로 작성된 설계 문서. 프로젝트명: `s210`.

---

## 1. 프로젝트 구성 요약

### 앱 서비스 (3개)

```
app/
  frontend/   ← React/Vite. 빌드 산출물이 nginx 이미지에 박힘 (multi-stage)
  backend/    ← Spring Boot. 기동 시 Flyway migration 자동 실행
  ai/         ← Python 서비스
```

- 프론트엔드는 **자체 컨테이너 없음** — dist가 nginx 이미지 안에 박힘
- 외부 진입점은 nginx 하나
  - `/` → frontend 정적 파일
  - `/api` → backend
  - `/ai` → AI 서비스

### 인프라 (상시 상주)

```
infra-common (수동 운영)
  mysql      ← Flyway migration 대상
  redis
  rabbitmq
```

- 앱 배포와 분리된 별도 compose로 관리
- 환경별로 컨테이너명/포트/볼륨 분리 (`dev-*`, `prod-*`)

---

## 2. 브랜치 전략

| 브랜치 | 용도 | 네이밍 예시 |
|---|---|---|
| `master` | 운영 배포 | — |
| `dev` | 통합 검증 + 개발 서버 배포 | — |
| `feature/*` | 기능 개발 | `feature/be/chat`, `feature/fe/login`, `feature/ai/rag` |
| `fix/*` | 버그 수정 | `fix/be/auth`, `fix/fe/modal` |

- 소문자 + 케밥케이스
- 서비스 구분 prefix: `/be/`, `/fe/`, `/ai/` (없으면 여러 서비스 동시 작업)

---

## 3. 파이프라인 트리거 규칙

```yaml
workflow:
  rules:
    - if: '$CI_COMMIT_BRANCH == "dev"'
    - if: '$CI_COMMIT_BRANCH == "master"'
    - when: never
```

| 이벤트 | 파이프라인 |
|---|---|
| `feature/*` / `fix/*` push | 없음 |
| MR 오픈/업데이트 | 없음 |
| MR 승인 → dev로 merge | ✅ dev 파이프라인 발동 |
| dev → master로 merge | ✅ master 파이프라인 발동 (배포는 manual) |
| `infra-common` 수동 재배포 | UI "Run pipeline" + `DEPLOY_INFRA=true` 변수 |

> **주의**: MR 단계에서는 build 검증이 없음. merge 후 build 실패 시 deploy는 `needs:` 때문에 skip되므로 **운영 중인 컨테이너는 그대로 유지**. deploy 자체가 실패한 경우 자동 복구 로직은 없으며 pipeline fail로 팀에 노출됨.

---

## 3-1. 파이프라인 파일 구조

```
.gitlab-ci.yml                       ← 엔트리: stages / workflow / default / include
.gitlab/ci/
  ├─ app.gitlab-ci.yml               ← 항상 로드
  │   generate_env_* / verify_infra_* / build_* / deploy_* / notify_* / cleanup_*
  └─ infra.gitlab-ci.yml             ← 조건부 로드
      deploy_infra_*
```

### `infra.gitlab-ci.yml` 로드 조건

엔트리의 `include: rules:` 에서 3가지 중 하나라도 매칭되면 로드:

1. dev 브랜치 push 에서 infra 관련 파일 변경
   - `infra/compose/docker-compose.infra-dev.yml`
   - `infra/scripts/deploy-infra-dev.sh`
   - `infra/scripts/common.sh`
   - `infra/scripts/health-check-infra.sh`
   - `infra/env/infra.dev.env.example`
2. master 브랜치 push 에서 대응되는 master 파일 변경
3. GitLab UI "Run pipeline" 에서 `DEPLOY_INFRA=true` 변수 전달

위 조건이 모두 빗나가면 **`deploy_infra_*` job 자체가 파이프라인에 존재하지 않음**.
→ `verify_infra_*`의 `needs: { job: deploy_infra_*, optional: true }` 가 자동 스킵 → build/deploy 흐름이 막히지 않음.

### 장점

- 평소 app-only push 에서 infra job 이 manual 상태로 걸려 뒤 stage 가 대기하는 문제 원천 제거
- infra 담당/app 담당이 리뷰할 diff 범위가 물리적으로 분리
- infra 로드된 경우 job 안에서는 **manual 클릭 없이 자동 실행** ("infra 를 올리기로 한 파이프라인은 무조건 올린다")

---

## 4. 알림 정책 (Discord)

| 브랜치 | 성공 | 실패 |
|---|---|---|
| `feature/*`, `fix/*` | 조용 (파이프라인 자체가 없음) | 조용 |
| `dev` | ✅ 초록 embed | ❌ 빨강 embed + 로그 경로 |
| `master` | ✅ 초록 embed | ❌ 빨강 embed + 로그 경로 |

`.post` stage에 `notify_success` / `notify_failure` 두 job을 두고 `when: on_success` / `when: on_failure`로 배타 실행.

---

## 5. 환경변수 관리 — GitLab Variables → env 파일 생성

### 변수 네이밍

```
ENV_BASE_*                 : 모든 env 파일에 공통 투입
ENV_<TARGET>_BACKEND_*     : <target>의 backend 변수
ENV_<TARGET>_FRONTEND_*    : <target>의 frontend 변수 (빌드 시 일부 주입)
ENV_<TARGET>_AI_*          : <target>의 ai 변수
ENV_<TARGET>_INFRA_*       : <target>의 MySQL/Redis/RabbitMQ 변수
```

`<TARGET>` ∈ `DEV`, `MASTER`.

### 변환 규칙 (CI의 `generate_env` stage가 처리)

prefix를 떼고 key만 env 파일에 씀:

```
ENV_BASE_REDIS_HOST=redis              → REDIS_HOST=redis            (app.*.env + infra.*.env 양쪽)
ENV_DEV_BACKEND_DB_PASSWORD=xxx        → DB_PASSWORD=xxx             (app.dev.env)
ENV_DEV_INFRA_MYSQL_ROOT_PASSWORD=yyy  → MYSQL_ROOT_PASSWORD=yyy     (infra.dev.env)
```

### 생성되는 파일 (2개 × 2 env = 4개)

```
/tmp/env/
  app.dev.env        ← backend + frontend + ai 변수를 합침 (+ BASE)
  app.master.env
  infra.dev.env      ← MySQL/Redis/RabbitMQ (+ BASE)
  infra.master.env
```

compose의 `env_file`은 `${ENV_DIR:-/tmp/env}/<file>` 형식.

> `.env.example`만 수정하면 배포에 반영되지 않습니다. **GitLab Variables에 `ENV_<TARGET>_<SERVICE>_<KEY>` 규칙으로 추가**해야 반영됩니다.

---

## 6. Flyway 통합

- **위치**: `app/backend/src/main/resources/db/migration/`
- **명명**: `V1__baseline.sql`, `V2__add_watchlist_table.sql` …
- **실행**: backend 컨테이너 기동 시 자동. 별도 CI job 없음.
- **규칙**:
  - 이미 적용된 migration 파일 **절대 수정 금지**
  - 변경 필요 시 **새 `Vn__*.sql` 추가**
  - `infra-common`(MySQL 서버 + 계정/DB 생성)은 Flyway 대상 아님 — 수동 운영
  - 스키마 변경(테이블/인덱스/제약)만 migration에 포함

---

## 7. 전체 파이프라인 — 브랜치별 흐름

```
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│  feature/* , fix/* │   │        dev         │   │       master       │
│  (push, MR, review)│   │  (merge from MR)   │   │  (merge from dev)  │
├────────────────────┤   ├────────────────────┤   ├────────────────────┤
│                    │   │   generate_env     │   │   generate_env     │
│                    │   │         │          │   │         │          │
│   (파이프라인 없음)│   │         ▼          │   │         ▼          │
│                    │   │ deploy_infra_*     │   │ deploy_infra_*     │
│                    │   │ (infra 파일 변경   │   │ (infra 파일 변경   │
│                    │   │  또는 DEPLOY_INFRA │   │  또는 DEPLOY_INFRA │
│                    │   │  =true 시 생성)    │   │  =true 시 생성)    │
│                    │   │         │          │   │         │          │
│                    │   │         ▼          │   │         ▼          │
│                    │   │  verify_infra_*    │   │  verify_infra_*    │
│                    │   │ (mysql/redis/mq    │   │ (mysql/redis/mq    │
│                    │   │  실접속 + creds    │   │  실접속 + creds    │
│                    │   │  정렬 검증)        │   │  정렬 검증)        │
│                    │   │         │          │   │         │          │
│                    │   │         ▼          │   │         ▼          │
│                    │   │   build_frontend   │   │   build_frontend   │
│                    │   │   build_backend    │   │   build_backend    │
│                    │   │   build_ai         │   │   build_ai         │
│                    │   │   (3개 병렬)       │   │   (3개 병렬)       │
│                    │   │         │          │   │         │          │
│                    │   │         ▼          │   │         ▼          │
│                    │   │   deploy_dev       │   │   deploy_master    │
│                    │   │   (local up)       │   │   (manual 승인)    │
│                    │   │         │          │   │         │          │
│                    │   │         ▼          │   │         ▼          │
│                    │   │   health_check     │   │   health_check     │
│                    │   │         │          │   │         │          │
│                    │   │   실패 시 그대로   │   │   실패 시 그대로   │
│                    │   │   pipeline fail    │   │   pipeline fail    │
└────────────────────┘   └────────────────────┘   └────────────────────┘
                                    │                        │
                                    ▼                        ▼
                              [.post stage]
                ┌──────────────────────────────────────────────┐
                │  on_success → notify_success                 │
                │  on_failure → notify_failure + FAILURE_LOG   │
                └──────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Discord 팀 채널     │
                         └──────────────────────┘

  [별도 파일] infra-common 파이프라인 (조건부 로드)
           ┌──────────────────────────────────────┐
           │  .gitlab/ci/infra.gitlab-ci.yml      │
           │   - infra 파일 변경 push 시 자동     │
           │   - DEPLOY_INFRA=true 시 수동        │
           │   mysql, redis, rabbitmq             │
           │   dev-*, prod-* 별개 컨테이너/볼륨   │
           └──────────────────────────────────────┘
```

---

## 8. Build stage 상세 — 서비스별 이미지 태깅

SSAFY GitLab은 Container Registry가 비활성이라 **push 없이 project runner(=배포 서버)의 docker daemon에 직접 태그만 생성**. 추후 registry 도입 시 `image_ref`에 prefix 붙이고 build/deploy 스크립트에 push/pull 한 줄씩 추가하면 확장됨.

```
 ┌──── build_frontend ───────────────────────────────────────┐
 │  bash infra/scripts/build-frontend.sh                     │
 │  docker build                                             │
 │    -f infra/docker/frontend.Dockerfile                    │
 │    -t s210-frontend:$CI_COMMIT_SHORT_SHA .                │
 │    Stage 1: node:24-alpine → pnpm build (dist)            │
 │    Stage 2: nginx:1.29-alpine ← dist 복사                 │
 └───────────────────────────────────────────────────────────┘

 ┌──── build_backend ────────────────────────────────────────┐
 │  bash infra/scripts/build-backend.sh                      │
 │  docker build                                             │
 │    -f app/backend/Dockerfile                              │
 │    -t s210-backend:$CI_COMMIT_SHORT_SHA                   │
 │    app/backend                                            │
 └───────────────────────────────────────────────────────────┘

 ┌──── build_ai ─────────────────────────────────────────────┐
 │  bash infra/scripts/build-ai.sh                           │
 │  docker build                                             │
 │    -f app/ai/Dockerfile                                   │
 │    -t s210-ai:$CI_COMMIT_SHORT_SHA                        │
 │    app/ai                                                 │
 └───────────────────────────────────────────────────────────┘

                              │  local tag
                              ▼
          ┌────────────────────────────────────────────┐
          │   배포 서버 docker daemon (유일 저장소)    │
          │                                            │
          │   s210-frontend:a1b2c3d   ← 최신           │
          │   s210-frontend:9f8e7d6                    │
          │   s210-backend:a1b2c3d                     │
          │   s210-backend:9f8e7d6                     │
          │   s210-ai:a1b2c3d                          │
          │   s210-ai:9f8e7d6                          │
          │                                            │
          │   (docker image prune cron으로 정리.       │
          │    긴급 복구용 최근 20개 이상 보존 권장)   │
          └────────────────────────────────────────────┘
```

> `$APP_IMAGE_TAG = $CI_COMMIT_SHORT_SHA` — commit마다 자동 새 값, **덮어쓰기 없음**. 긴급 복구(변수 override 재배포)의 전제.

---

## 9. generate_env stage — Variables → env 파일

```
 GitLab CI job (generate_env)
     │
     ▼
 bash infra/scripts/generate-env.sh <dev|master>
     │
     ▼
 환경변수 탐색:
   ENV_BASE_*                     → 공통 (app + infra 양쪽)
   ENV_<TARGET>_BACKEND_*         → app.<target>.env
   ENV_<TARGET>_FRONTEND_*        → app.<target>.env
   ENV_<TARGET>_AI_*              → app.<target>.env
   ENV_<TARGET>_INFRA_*           → infra.<target>.env
     │
     ▼
 prefix 제거 후 파일로 쓰기:
   ENV_BASE_REDIS_HOST=redis         → REDIS_HOST=redis
   ENV_DEV_BACKEND_DB_PASSWORD=xxx   → DB_PASSWORD=xxx
     │
     ▼
 결과 파일 (Linux 서버 기준):
   /tmp/env/app.dev.env
   /tmp/env/infra.dev.env
     │
     ▼
 CI artifacts로 보관 (expire_in: 1 hour, deploy job에서 사용)
```

### 구현 개요

```bash
# infra/scripts/generate-env.sh
TARGET="${1:?usage: $0 <dev|master>}"
OUT_DIR="${OUT_DIR:-/tmp/env}"
target_upper=$(echo "$TARGET" | tr '[:lower:]' '[:upper:]')

append_prefix_match() {   # env에서 prefix로 시작하는 줄 추출 + prefix 제거
  local prefix="$1"; local out="$2"
  env | awk -v p="$prefix" 'index($0, p) == 1 { sub("^" p, ""); print }' >> "$out"
}

APP_OUT="$OUT_DIR/app.${TARGET}.env"
INFRA_OUT="$OUT_DIR/infra.${TARGET}.env"
: > "$APP_OUT"; : > "$INFRA_OUT"

append_prefix_match "ENV_BASE_" "$APP_OUT"
append_prefix_match "ENV_BASE_" "$INFRA_OUT"
for svc in BACKEND FRONTEND AI; do
  append_prefix_match "ENV_${target_upper}_${svc}_" "$APP_OUT"
done
append_prefix_match "ENV_${target_upper}_INFRA_" "$INFRA_OUT"
```

---

## 10. Deploy stage 상세

```
deploy_dev 시작  (master도 동일, manual gate만 추가)
     │
     ▼
 export APP_IMAGE_TAG=$CI_COMMIT_SHORT_SHA
 # build 단계에서 로컬 daemon에 이미 s210-<svc>:<tag> 태그 존재
 docker compose --env-file /tmp/env/app.<env>.env \
                -f infra/compose/docker-compose.app-<env>.yml \
                up -d --no-build
     │
     ▼
 health-check-<env>.sh all                 (/, /api/health, /ai/health)
     │
 ┌───┴───┐
 성공    실패
 │       │
 ▼       ▼
 pipeline 정상 종료   pipeline fail (set -euo pipefail로 exit code 전파)
                      ↓
                      .post의 notify_failure가 Discord 알림
                      ↓
                      팀이 수동 복구:
                        · git revert <bad_sha> + push (정방향, 권장)
                        · 또는 GitLab pipeline 변수 APP_IMAGE_TAG=<prev_sha>로 deploy_* 재실행
         │                         │
         └────── .post ────────────┘
                   │
                   ▼
           notify_success 또는 notify_failure
```

### 설계 결정 — 자동 rollback 미채택

초기 설계에서 `trap ERR → read_last_ok_tag → 이전 태그 재배포` 로직을 두었으나 제거:

1. **build 실패 케이스는 이미 안전** — `deploy_*.needs:[build_*]`로 인해 build 실패 시 deploy 자체가 skip. 운영 컨테이너는 영향 없음. rollback 불필요.
2. **deploy 중 실패는 드물게 health check 실패** — 이 경우에도 근본 원인(env 누락, migration 버그 등)은 rollback으로 안 고쳐짐. 개발자가 원인 수정 + 재배포 필요.
3. **이미지 보존 정책과 충돌** — rollback은 이전 이미지가 서버 디스크에 남아 있어야 동작. 공격적 cleanup이 불가능해지고 디스크 누적 문제 유발.
4. **복잡성 감소** — `last_ok_tag_*` state 파일, trap 로직, `rollback-*.sh` 스크립트 전부 제거로 scripts 단순화.

복구 경로는 단일화: **pipeline 실패는 팀에게 명시적으로 노출 → 원인 수정 → 정방향 재배포**. 긴급 시 GitLab 변수 override.

---

## 11. 알림 데이터 흐름

```
 파이프라인 종료
     │
 ┌───┴───┐
 전체성공  하나라도실패
     │           │
     ▼           ▼
 notify_success  notify_failure
     │           │
     └─────┬─────┘
           │
           ▼
       notify.sh
  (jq로 Discord embed 생성 → tmpfile → --data-binary @file)
           │
           ▼
 ┌──────────────────────────────────┐
 │  ✅ SUCCESS · deploy_dev          │
 │  s210 / dev @ a1b2c3d             │
 │  stage/triggered by/pipeline      │
 └──────────────────────────────────┘
         또는
 ┌──────────────────────────────────┐
 │  ❌ FAILED · deploy_dev           │
 │  ...                              │
 │  logs: /srv/s210/dev/logs/...     │
 └──────────────────────────────────┘
```

---

## 12. 시스템 구성도 — 전체

```
[개발자 PC]        [GitLab]                    [배포 서버 = project runner]
                                             ┌──────────────────────────┐
  git push ──►  ┌──────────┐   trigger       │  GitLab Runner            │
   (feature,    │  Repo    │ ──────────────► │   bash scripts             │
    fix,        └──────────┘                 │   (docker, curl, jq 사용) │
    dev,                                     │           │                │
    master)                                  │           ▼ build          │
                                             │  Docker daemon (local tag) │
  (Container Registry 미사용 —               │           │                │
   이미지는 이 서버에만 존재)                │           ▼ up             │
                                             ├──────────────────────────┤
                                             │  Docker Engine            │
                                              │   dev-nginx               │
                                              │   dev-backend             │
                                              │   dev-ai                  │
                                              │   prod-nginx              │
                                              │   prod-backend            │
                                              │   prod-ai                 │
                                              │                           │
                                              │   (상시 가동 infra-common)│
                                              │   dev-mysql,  prod-mysql  │
                                              │   dev-redis,  prod-redis  │
                                              │   dev-rabbitmq,           │
                                              │   prod-rabbitmq           │
                                              └──────────────────────────┘

   /srv/s210/
     dev/     (state 디렉토리 없음 — rollback 없으므로)
     master/
                                         │ curl
                                         ▼
                               ┌──────────────────────┐
                               │   Discord API        │
                               └──────────────────────┘
```

---

## 13. 커밋/브랜치/MR 컨벤션 (참고)

CI 자체는 `feature/*`, `fix/*` push에 반응하지 않지만 팀 표준을 위해 명시:

### 커밋 메시지

```
[FE/BE/AI] Type: 요구사항ID 대제목

- 상세 설명 1
- 상세 설명 2
```

**Type**: Init, Add, Delete, Feat, Fix, Build, Chore, Docs, Style, Refactor, Test, Release, Rename, Readme, Comment

### MR 템플릿

```markdown
## 📄 MR 한 줄 요약
MR 내용을 한 문장으로 요약해주세요.

## 🧑‍💻 MR 세부 내용
- 수정/추가한 내용을 상세히 작성해주세요.

## 📎 Issue 번호
<!-- closed #이슈번호 -->
```

### 배포 트리거 규칙 (요약)

- dev 서버 배포 = feature/fix → dev MR → merge
- master 서버 배포 = dev → master MR → merge → **manual 승인 클릭**

---

## 14. 시간축 예시

```
시간 ──────────────────────────────────────────────────►

 [feature/be/chat 작업 중]
   push push push        (아무 일 없음)
   MR 생성 → dev로       (아무 일 없음)
   리뷰 승인             (아무 일 없음)
   MR merge              ──► dev pipeline 발동 ★
                              build + deploy + health
                              성공 → Discord ✅

 [다음 commit이 dev에 들어옴]
   build → deploy_dev → health FAIL
                        pipeline fail (자동 복구 없음)
                        Discord ❌
                        팀: git revert → push 로 정방향 복구
                             또는 GitLab pipeline 변수 override로 이전 SHA 재배포

 [dev → master MR merge]
   build 자동 실행 → deploy_master manual 대기
   팀원 manual 승인 클릭
   deploy_master → health OK → Discord ✅
```

---

## 15. 핵심 규칙 정리

```
feature/*, fix/*   : CI 없음 (push/MR 시 조용)
dev                : merge → generate_env → (deploy_infra 조건부) → verify_infra → build(3개 병렬) → deploy → health
                      └ 성공 → Discord 초록
                      └ 실패 → Discord 빨강 + 로그 (자동 rollback 없음, 팀 수동 복구)

master             : merge → build → manual 승인 → deploy → health
                      └ 알림 정책 dev와 동일

infra-common       : 수동 관리 (deploy-infra-<env>.sh)
                     MySQL/Redis/RabbitMQ 변경 시에만 실행
                     Flyway migration은 backend 기동 시 자동
```

### 불변성 / 복구 원칙

1. **이미지 태그는 `$CI_COMMIT_SHORT_SHA`** — `latest` 금지. 덮어쓰기 없음.
2. **자동 rollback 없음** — deploy 실패는 pipeline fail로 표면화. 팀이 원인 수정 후 재배포.
3. **긴급 복구 경로** — GitLab pipeline 재실행 시 `APP_IMAGE_TAG=<prev_sha>` 변수 override → 이전 태그 이미지로 재배포. 배포 서버 docker daemon에 이전 SHA 이미지가 남아 있어야 가능 (`docker image prune` 너무 공격적으로 잡지 말 것, 최근 20개 이상 권장).

### 환경변수 원칙

- `.env.example` 수정만으로는 배포에 반영되지 않음
- **GitLab Variables에 `ENV_<TARGET>_<SERVICE>_<KEY>` 규칙으로 추가**해야 CI의 `generate_env`가 실제 env로 변환
