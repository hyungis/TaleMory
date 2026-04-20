# CI/CD 파이프라인 흐름도

> 팀 Git 컨벤션과 실제 프로젝트 구조(MySQL + RabbitMQ + Redis, 3개 앱 서비스)를 기준으로 작성된 설계 문서.

---

## 1. 프로젝트 구성 요약

### 앱 서비스 (3개)

```
app/
  frontend/   ← React/Vite. nginx 이미지에 빌드 결과 포함
  backend/    ← Spring Boot. 기동 시 Flyway migration 자동 실행
  ai/         ← Python 서비스
```

- 프론트엔드는 **자체 컨테이너 없음** — 빌드 산출물이 nginx 이미지 안에 박힘
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
- 환경별로 컨테이너명/포트/볼륨 분리 (dev-*, prod-*)

---

## 2. 브랜치 전략

| 브랜치 | 용도 | 네이밍 예시 |
|---|---|---|
| `master` | 운영 배포 | — |
| `dev` | 통합 검증 + 개발 서버 배포 | — |
| `feature/*` | 기능 개발 | `feature/be/chat`, `feature/fe/login`, `feature/ai/rag`, `feature/chat` |
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
| `infra-common` 수동 배포 | 별도 manual job |

> **주의**: MR 리뷰 단계에서 build 검증이 없음. merge 후 build 실패는 deploy 실패로 이어지지만 **롤백이 자동으로 걸려 dev 서버는 깨지지 않음**.

---

## 4. 알림 정책 (Discord)

| 브랜치 | 성공 | 실패 |
|---|---|---|
| `feature/*`, `fix/*` | 조용 (파이프라인 자체가 없음) | 조용 |
| `dev` | ✅ 초록 | ❌ 빨강 + 로그 경로 |
| `master` | ✅ 초록 | ❌ 빨강 + 로그 경로 |

`.post` stage에 `notify_success` / `notify_failure` 두 job을 두고 `when: on_success` / `when: on_failure`로 배타 실행.

---

## 5. 환경변수 관리 — GitLab Variables → `.env` 파일 생성

### 변수 네이밍

```
ENV_BASE_*              : 모든 환경 공통
ENV_DEV_BACKEND_*       : dev 백엔드
ENV_DEV_FRONTEND_*      : dev 프론트엔드 (빌드 시 주입)
ENV_DEV_AI_*            : dev AI
ENV_MASTER_BACKEND_*    : master 백엔드
ENV_MASTER_FRONTEND_*   : master 프론트엔드
ENV_MASTER_AI_*         : master AI
```

### 변환 규칙 (CI의 `generate_env` stage가 처리)

```
ENV_BASE_REDIS_HOST=redis        → dev-*.env, master-*.env 에 REDIS_HOST=redis
ENV_DEV_BACKEND_DB_PASSWORD=...  → dev-backend.env 에 DB_PASSWORD=...
ENV_DEV_FRONTEND_AUTH_USE_MOCK=true → dev-frontend.env 에 AUTH_USE_MOCK=true
```

prefix가 벗겨지고 나머지만 실제 env 파일에 들어갑니다.

### 생성되는 파일

```
/tmp/env/
  dev-backend.env
  dev-frontend.env
  dev-ai.env
  master-backend.env
  master-frontend.env
  master-ai.env
```

> `.env.example`만 수정하면 배포에 반영되지 않습니다. **반드시 GitLab Variables에 `ENV_<TARGET>_<KEY>` 규칙으로 추가**해야 반영됩니다.

---

## 6. Flyway 통합

- **위치**: `app/backend/src/main/resources/db/migration/`
- **명명**: `V1__baseline.sql`, `V2__add_watchlist_table.sql` …
- **실행**: backend 컨테이너 기동 시 자동. 별도 CI job 없음.
- **규칙**:
  - 이미 적용된 migration 파일 **절대 수정 금지**
  - 변경 필요 시 **새 `Vn__*.sql` 추가**
  - `infra-common` (MySQL 서버 + 계정/DB 생성)은 Flyway 대상 아님 — 수동 운영
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
│                    │   │   build_frontend   │   │   build_frontend   │
│                    │   │   build_backend    │   │   build_backend    │
│                    │   │   build_ai         │   │   build_ai         │
│                    │   │   (3개 병렬)       │   │   (3개 병렬)       │
│                    │   │         │          │   │         │          │
│                    │   │         ▼          │   │         ▼          │
│                    │   │ deploy_dev_frontend│   │ deploy_master_*    │
│                    │   │ deploy_dev_backend │   │  (manual 승인)     │
│                    │   │ deploy_dev_ai      │   │                    │
│                    │   │   (3개 병렬, auto) │   │                    │
│                    │   │         │          │   │         │          │
│                    │   │         ▼          │   │         ▼          │
│                    │   │   health_check_dev │   │   health_check_m   │
│                    │   │         │          │   │         │          │
│                    │   │     성공 시        │   │     성공 시        │
│                    │   │  record_ok_tag     │   │  record_ok_tag     │
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
                         │  Discord 팀 채널      │
                         └──────────────────────┘

  [별도] infra-common 관리 (수동, 상시 가동 인프라)
           ┌──────────────────────────────────────┐
           │  deploy_base_manual (when: manual)   │
           │   mysql, redis, rabbitmq             │
           │   dev-*, prod-* 별개 컨테이너/볼륨   │
           └──────────────────────────────────────┘
```

---

## 8. Build stage 상세 — 서비스별 이미지 태깅

```
 ┌──── build_frontend ───────────────────────────────────────┐
 │  pnpm install & build  (→ dist)                           │
 │  docker build                                             │
 │    -f infra/app/nginx/Dockerfile                          │
 │    -t $REGISTRY/talemory-frontend:$CI_COMMIT_SHORT_SHA .  │
 │  docker push ...                                          │
 │                                                           │
 │  artifacts: when: always                                  │
 └───────────────────────────────────────────────────────────┘

 ┌──── build_backend ────────────────────────────────────────┐
 │  ./gradlew clean build -x test                            │
 │  docker build                                             │
 │    -f app/backend/Dockerfile                              │
 │    -t $REGISTRY/talemory-backend:$CI_COMMIT_SHORT_SHA .   │
 │  docker push ...                                          │
 └───────────────────────────────────────────────────────────┘

 ┌──── build_ai ─────────────────────────────────────────────┐
 │  docker build                                             │
 │    -f app/ai/Dockerfile                                   │
 │    -t $REGISTRY/talemory-ai:$CI_COMMIT_SHORT_SHA .        │
 │  docker push ...                                          │
 └───────────────────────────────────────────────────────────┘

                              │  push
                              ▼
          ┌────────────────────────────────────────────┐
          │   GitLab Container Registry                │
          │                                            │
          │   talemory-frontend:a1b2c3d   ← 최신       │
          │   talemory-frontend:9f8e7d6                │
          │   talemory-backend:a1b2c3d                 │
          │   talemory-backend:9f8e7d6                 │
          │   talemory-ai:a1b2c3d                      │
          │   talemory-ai:9f8e7d6                      │
          │                                            │
          │   (cleanup policy로 오래된 태그 자동 삭제  │
          │    last_ok 태그는 보존)                    │
          └────────────────────────────────────────────┘
```

> `$APP_IMAGE_TAG = $CI_COMMIT_SHORT_SHA` — commit마다 자동 새 값, **덮어쓰기 없음**. 롤백의 전제.

---

## 9. generate_env stage — Variables → env 파일

```
 GitLab CI job (generate_env)
     │
     ▼
 환경변수 탐색:
   ENV_BASE_*           → 공통
   ENV_DEV_BACKEND_*    → dev 백엔드 (if branch == dev)
   ENV_DEV_FRONTEND_*   → dev 프론트 (if branch == dev)
   ENV_DEV_AI_*         → dev AI    (if branch == dev)
   ENV_MASTER_*_*       → master (if branch == master)
     │
     ▼
 prefix 제거 후 파일로 쓰기:
   ENV_BASE_REDIS_HOST=redis       → REDIS_HOST=redis
   ENV_DEV_BACKEND_DB_PASSWORD=xxx → DB_PASSWORD=xxx
     │
     ▼
 결과 파일:
   /tmp/env/dev-backend.env
   /tmp/env/dev-frontend.env
   /tmp/env/dev-ai.env
     │
     ▼
 CI artifacts로 보관 (expire_in: 1 hour, build 및 deploy job에서 사용)
```

### 구현 스케치

```bash
# infra/scripts/generate-env.sh (예시)
TARGET=$1   # "dev" 또는 "master"
OUT_DIR=${2:-/tmp/env}
mkdir -p "$OUT_DIR"

for service in BACKEND FRONTEND AI; do
  out="$OUT_DIR/${TARGET,,}-${service,,}.env"
  : > "$out"

  # 공통
  env | grep -E "^ENV_BASE_" | sed "s|^ENV_BASE_||" >> "$out"

  # 타겟 + 서비스
  env | grep -E "^ENV_${TARGET^^}_${service}_" \
      | sed "s|^ENV_${TARGET^^}_${service}_||" >> "$out"
done
```

---

## 10. Deploy stage 상세 — Rollback 포함

```
deploy_dev_backend 시작  (deploy_dev_frontend, deploy_dev_ai 각각 병렬 동일 흐름)
     │
     ▼
 PREV=$(current_running_tag backend)   ← 현재 돌고 있는 서비스 태그 백업
     │
     ▼
 trap ERR 설정 → 실패 시 자동:
                 1) dump_failure_logs
                 2) rollback_to_last_ok (해당 서비스만)
                 3) FAILURE_LOG_DIR export
     │
     ▼
 export APP_IMAGE_TAG=$CI_COMMIT_SHORT_SHA
     │
     ▼
 docker compose pull backend
 docker compose up -d backend           (프론트/AI는 각자 job에서)
     │
     ▼
 health-check-dev.sh backend            (/api/health 등)
     │
 ┌───┴───┐
 성공    실패
 │       │
 ▼       ▼
 record_ok_tag(dev, backend, 새태그)   trap 발동
                                       /srv/talemory/dev/logs/... dump
                                       state/dev/last_ok_tag_backend 읽어서
                                       docker compose up -d backend (직전태그)
                                       exit 1
         │                         │
         └────── .post ────────────┘
                   │
                   ▼
           notify_success 또는 notify_failure
```

### 롤백의 기본 3규칙 (서비스별로 독립)

1. **이미지 태그 = `$CI_COMMIT_SHORT_SHA`** — `latest` 금지
2. **`last_ok_tag_<service>`는 해당 서비스 health check 통과 시에만 갱신**
3. **rollback은 state 파일을 소스로** — 현재 pipeline의 commit과 무관

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
 │  ✅ SUCCESS · deploy_dev_backend │
 │  talemory / dev @ a1b2c3d        │
 │  stage/triggered by/pipeline     │
 └──────────────────────────────────┘
         또는
 ┌──────────────────────────────────┐
 │  ❌ FAILED · deploy_dev_backend  │
 │  ...                             │
 │  logs: /srv/talemory/dev/logs/.. │
 └──────────────────────────────────┘
```

---

## 12. 시스템 구성도 — 전체

```
[개발자 PC]        [GitLab]                    [배포 서버 = project runner]
                                             ┌──────────────────────────┐
  git push ──►  ┌──────────┐   trigger       │  GitLab Runner            │
   (feature,   │  Repo    │ ──────────────►  │   bash scripts (jq, docker,│
    fix,       └──────────┘                  │    curl 사용)             │
    dev,             │                       └────────────┬──────────────┘
    master)          ▼                                    │
            ┌────────────────┐ ◄───push──────────push─────┤
            │  Container     │                            │
            │  Registry      │ ◄───pull───────────────────┤
            └────────────────┘                            ▼
                                              ┌──────────────────────────┐
                                              │  Docker Engine            │
                                              │   dev-nginx (frontend)    │
                                              │   dev-backend             │
                                              │   dev-ai                  │
                                              │   prod-nginx (frontend)   │
                                              │   prod-backend            │
                                              │   prod-ai                 │
                                              │                           │
                                              │   (상시 가동, infra-common)│
                                              │   dev-mysql, prod-mysql   │
                                              │   dev-redis, prod-redis   │
                                              │   dev-rabbitmq,           │
                                              │   prod-rabbitmq           │
                                              └──────────────────────────┘

   /srv/talemory/
     dev/
       state/
         last_ok_tag_frontend          ← 롤백 소스 (서비스별)
         last_ok_tag_backend
         last_ok_tag_ai
         previous_ok_tag_*
       logs/20260420-140233/           ← 실패 시 dump
     master/
       state/
         last_ok_tag_frontend
         last_ok_tag_backend
         last_ok_tag_ai
         previous_ok_tag_*
       logs/...
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
   MR 생성 → dev로        (아무 일 없음)
   리뷰 승인              (아무 일 없음)
   MR merge               ──► dev pipeline 발동 ★
                               build + deploy + health
                               성공 → Discord ✅

 [다음 commit이 dev에 들어옴]
   build → deploy_dev_backend → health FAIL
                               trap: dump logs
                               rollback backend → 이전 태그
                               state 변경 없음
                               Discord ❌ + logs 경로

 [dev → master MR merge]
   build 자동 실행 → deploy_master_* manual 대기
   팀원 manual 승인 클릭
   deploy_master_* → health OK → Discord ✅
```

---

## 15. 핵심 규칙 정리

```
feature/*, fix/*   : CI 없음 (push/MR 시 조용)
dev                : merge → build(3개 병렬) → deploy(3개 병렬) → health → 롤백 대응
                      └ 성공 → Discord 초록
                      └ 실패 → Discord 빨강 + 로그 경로 + 자동 rollback

master             : merge → build → manual 승인 → deploy → health → 롤백 대응
                      └ 알림 정책 dev와 동일

infra-common       : 수동 관리 (deploy_base_manual)
                     MySQL/Redis/RabbitMQ 변경 시에만 실행
                     Flyway migration은 backend 기동 시 자동
```

### 불변성을 보장하는 3요소

1. **이미지 태그는 `$CI_COMMIT_SHORT_SHA`** — `latest` 금지
2. **`last_ok_tag_<service>`는 health 통과 시에만 갱신** — 서비스별 독립
3. **rollback은 state 파일을 소스로** — pipeline commit과 무관하게 "마지막 확인된 정상"으로 복귀

### 환경변수 원칙

- `.env.example` 수정만으로는 배포에 반영되지 않음
- **GitLab Variables에 `ENV_<TARGET>_<KEY>` 규칙으로 추가**해야 CI의 `generate_env`가 실제 env로 변환
