# GitLab CI/CD Variables 카탈로그

S210의 **CI/운영 배포용** 환경변수 단일 문서. GitLab → **Settings → CI/CD → Variables**에 등록하는 모든 키를 여기서 관리한다.

> **로컬 개발 env는 이 문서와 무관**. 로컬은 repo 루트의 `.env.example` 참조.

---

## 1. 동작 원리

GitLab CI Variables는 **두 종류**로 등록된다 (하이브리드):

```
GitLab CI Variables
├── File Variable (Type=File)                 ← 비밀이 아닌 설정값 묶음
│     ENV_DEV_APP_ENV_FILE   = (env 파일 통째)
│     ENV_DEV_INFRA_ENV_FILE = (env 파일 통째)
│     ENV_MASTER_APP_ENV_FILE / ENV_MASTER_INFRA_ENV_FILE
│
└── 개별 Variable (Type=Variable + Masked) ← 진짜 비밀값
      ENV_DEV_APP_DB_PASSWORD       = xxx
      ENV_DEV_APP_JWT_ACCESS_SECRET = xxx
      ENV_DEV_APP_KAKAO_CLIENT_SECRET = xxx
      ...
          │
          ▼
pipeline 실행 시 job 환경변수로 주입
  - File 변수 → runner 의 임시 파일 경로 (예: /runner/build/var/abc123)
  - 개별 변수 → 일반 환경변수
          │
          ▼
bash infra/scripts/generate-env.sh <dev|master>
  ① ENV_<TARGET>_<SCOPE>_ENV_FILE 이 가리키는 파일을 base 로 cp
  ② ENV_BASE_*, ENV_<TARGET>_<SCOPE>_* 개별 변수를 그 위에 append
     (하이브리드 키 `ENV_FILE` 만 awk 필터로 제외 — 자기 재귀 방지)
          │
          ▼
출력:
  /tmp/env/app.<target>.env    ← backend + frontend + ai
  /tmp/env/infra.<target>.env  ← mysql + redis + rabbitmq
          │
          ▼
infra/compose/docker-compose.{app,infra}-<target>.yml 이 env_file 로 주입
```

같은 키가 ①·② 양쪽에 있으면 **②(개별 Masked) 값이 이김** — `env_file:` 의 표준 동작 (last KEY=VALUE wins). → 비밀은 File 에 placeholder 만 두고 진짜 값은 개별 Masked 변수로 두는 패턴.

`.env.example` 같은 실 파일이 repo에 없음. CI runtime에만 `/tmp/env/`에 존재 → pipeline 종료 시 runner ephemeral 스토리지라 정리됨 (project runner면 재부팅까지 유지).

---

## 1-A. 하이브리드 마이그레이션 가이드

### 왜 하이브리드?

40+개 개별 변수를 GitLab UI 에서 하나하나 클릭으로 등록하는 수고를 줄이기 위해, **비밀이 아닌 값들은 File Variable 한 개에 통째 업로드**한다. 비밀은 여전히 개별 Masked 변수로 유지 → CI 로그 자동 마스킹 보존.

체크박스 등록 작업: 40+ → ~13개 (-70%).

### 등록 양식 어디 보고?

`docs/gitlab-variables.md` 가 환경별로 두 종류를 나눠 안내한다:
- **File Variable** 섹션 — 코드 블록을 통째 복사해 GitLab File 변수에 붙여넣기
- **개별 Masked Variables** 섹션 — 체크박스로 한 줄씩 등록

### 기존 변수 살리고 점진 마이그레이션 OK

`generate-env.sh` 가 File 우선 → 개별 append 순서이고, 같은 KEY 가 둘 다 있으면 **개별이 이김**. 따라서:

| 마이그레이션 단계 | 동작 |
|------------------|------|
| (A) File 미등록, 개별만 있음 (변경 전 상태) | 기존 prefix 매칭만 동작 — 그대로 정상 |
| (B) File 등록 + 개별도 그대로 (중간 상태) | File 깔리고 개별이 override — 동작 동일 |
| (C) 비민감 개별 삭제 후 File 만 (최종) | File 값 사용 — 등록 부담 최소 |

→ 어느 중간 상태에서도 시스템이 깨지지 않음. 안 풀리면 File 변수 하나만 삭제해 (A) 로 즉시 롤백 가능.

### File Variable 작성 시 주의 (Footguns)

| 실수 | 결과 |
|------|------|
| `KEY="value"` (값에 따옴표) | env_file 은 따옴표 안 벗김 → 값에 literal `"` 포함 |
| 줄 끝이 CRLF (Windows) | 일부 파서가 `value\r` 로 인식 → 비교/연결 실패 |
| 키 오타 (`DB_URLL=`) | 개별 변수에 같은 키가 없으면 default fallback → 조용한 버그 |
| 비밀값을 File 에 넣음 | 동작은 하지만 GitLab 마스킹 못 받음 → 로그 노출 위험 |

권장:
- 값에 따옴표 절대 X (`KEY=value`)
- 에디터에서 줄바꿈 **LF (Unix)** 로 저장
- 비밀은 File 에 placeholder, 진짜 값은 개별 Masked Variable

---

## 2. 변수 네이밍 규칙

| Prefix 형식 | GitLab Type | 투입되는 파일 | 대상 컨테이너 |
|---|---|---|---|
| `ENV_<TARGET>_APP_ENV_FILE` | **File** | `app.<target>.env` (통째 cp) | backend + frontend + ai |
| `ENV_<TARGET>_INFRA_ENV_FILE` | **File** | `infra.<target>.env` (통째 cp) | mysql / redis / rabbitmq |
| `ENV_BASE_<KEY>` | Variable | `app.*.env` + `infra.*.env` 양쪽 | 공통 |
| `ENV_<TARGET>_APP_<KEY>` | Variable (Masked 권장) | `app.<target>.env` (append) | backend + frontend + ai |
| `ENV_<TARGET>_INFRA_<KEY>` | Variable (Masked 권장) | `infra.<target>.env` (append) | mysql / redis / rabbitmq |

`<TARGET>` ∈ `DEV`, `MASTER`. **하이브리드 키만 정확히 차단**하기 위해 `generate-env.sh` 의 awk 필터는 prefix strip 후 `ENV_FILE` 과 정확 일치하는 경우에만 제외 — `TLS_CERT_FILE`, `CONFIG_FILE` 같은 일반 `_FILE` 접미사 변수는 영향 없이 통과.

변환 예시:

```
ENV_DEV_APP_ENV_FILE=/runner/build/var/abc  → /tmp/env/app.dev.env 로 통째 cp (base)
ENV_BASE_REDIS_HOST=redis                   → REDIS_HOST=redis  (양쪽 파일에 append)
ENV_DEV_APP_DB_PASSWORD=xxx                 → DB_PASSWORD=xxx   (app.dev.env 에 append, File 보다 뒤)
ENV_DEV_INFRA_MYSQL_PASSWORD=xxx            → MYSQL_PASSWORD=xxx (infra.dev.env 에 append)
```

→ File 의 비민감값과 개별 Masked 변수가 합쳐져 단일 env 파일로 출력됨. 같은 키 충돌 시 마지막 값(개별 Masked)이 이김.

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
| `ENV_DEV_APP_OAUTH_ALLOWED_REDIRECT_URIS` | — | comma-separated allowed Kakao frontend callback URIs (`http://talemory.site:3001/auth/kakao/callback,https://talemory.site:3443/auth/kakao/callback`) |
| `ENV_DEV_APP_KAKAO_CLIENT_ID` | — | dev Kakao REST API key |
| `ENV_DEV_APP_VITE_KAKAO_CLIENT_ID` | — | dev Kakao REST API key (Vite build-time 주입) |
| `ENV_DEV_APP_KAKAO_CLIENT_SECRET` | ✅ | dev Kakao client secret |
| `ENV_DEV_APP_AWS_ACCESS_KEY_ID` | ✅ | `s210-backend-s3` IAM user Access Key ID (S3 presign / 소프트삭제용) |
| `ENV_DEV_APP_AWS_SECRET_ACCESS_KEY` | ✅ | `s210-backend-s3` IAM user Secret Access Key |
| `ENV_DEV_APP_AWS_REGION` | — | `ap-northeast-2` (AWS SDK 표준 env 이름 — region 자동 인식용) |
| `ENV_DEV_APP_AWS_S3_BUCKET` | — | `s210-iportfolio-dev` — 사용자 사진 + 생성 이미지 저장 버킷 |
| `ENV_DEV_APP_AWS_S3_ENV_PREFIX` | — | `dev` — 같은 버킷에서 환경(local/dev/prod) 격리용 root prefix. BE/AI 워커가 모든 S3 key 앞에 prepend |
| `ENV_DEV_APP_FRONTEND_PORT` | — | `3001` (호스트 publish 포트) |
| `ENV_DEV_APP_VITE_API_BASE_URL` | — | `/api` (Vite build-time 주입) |
| `ENV_DEV_APP_OPENAI_API_KEY` | ✅ | OpenAI API 키 |
| `ENV_DEV_APP_GEMINI_API_KEY` | ✅ | Gemini API 키 (storyboard 이미지 생성). 미설정 시 이미지 생성 호출 실패 |
| `ENV_DEV_APP_REPLICATE_API_TOKEN` | ✅ | Replicate API 토큰 (final illustration 생성). 미설정 시 1픽셀 검은 PNG fallback 으로 떨어짐 |
| `ENV_DEV_APP_RABBITMQ_TTS_PREVIEW_QUEUE` | — | `ai.gpu.preview.request.queue` |
| `ENV_DEV_APP_RABBITMQ_TTS_PREVIEW_ROUTING_KEY` | — | `ai.gpu.tts.preview` |
| `ENV_DEV_APP_STORYBOARD_IMAGE_MODEL` | — | `gemini-2.5-flash-image` |
| `ENV_DEV_APP_STORYBOARD_IMAGE_INPUT_COST_PER_1M` | no | `0.30` |
| `ENV_DEV_APP_STORYBOARD_IMAGE_OUTPUT_COST_PER_IMAGE` | no | `0.039` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_GENERATE_QUEUE` | — | `ai.image.generate.request.queue` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_GENERATE_ITEM_QUEUE` | — | `ai.image.generate.item.request.queue` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_REGENERATE_QUEUE` | — | `ai.image.regenerate.request.queue` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_GENERATE_ROUTING_KEY` | — | `ai.image.generate` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_GENERATE_ITEM_ROUTING_KEY` | — | `ai.image.generate.item` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_REGENERATE_ROUTING_KEY` | — | `ai.image.regenerate` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_GENERATE_COMPLETED_ROUTING_KEY` | — | `ai.result.image.generate.completed` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_GENERATE_FAILED_ROUTING_KEY` | — | `ai.result.image.generate.failed` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_REGENERATE_COMPLETED_ROUTING_KEY` | — | `ai.result.image.regenerate.completed` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_REGENERATE_FAILED_ROUTING_KEY` | — | `ai.result.image.regenerate.failed` |
| `ENV_DEV_APP_FINAL_ILLUSTRATION_MODEL` | — | `black-forest-labs/flux-2-klein-9b` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_QUEUE` | — | `ai.final-illustration.generate.request.queue` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_QUEUE` | — | `ai.final-illustration.generate.item.request.queue` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_REVISE_QUEUE` | — | `ai.final-illustration.revise.request.queue` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ROUTING_KEY` | — | `ai.image.final-illustration.generate` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_ROUTING_KEY` | — | `ai.image.final-illustration.generate.item` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_REVISE_ROUTING_KEY` | — | `ai.image.final-illustration.revise` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_COMPLETED_ROUTING_KEY` | — | `ai.result.final-illustration.generate.completed` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_FAILED_ROUTING_KEY` | — | `ai.result.final-illustration.generate.failed` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_REVISE_COMPLETED_ROUTING_KEY` | — | `ai.result.final-illustration.revise.completed` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_REVISE_FAILED_ROUTING_KEY` | — | `ai.result.final-illustration.revise.failed` |
| `ENV_DEV_APP_PROJECT_NAME` | — | `S210 AI API` |
| `ENV_DEV_APP_APP_VERSION` | — | `0.1.0` |
| `ENV_DEV_APP_ENVIRONMENT` | — | `local` |
| `ENV_DEV_APP_STORYBOARD_MODEL` | — | `gpt-4o-mini` |
| `ENV_DEV_APP_STORYBOARD_INPUT_COST_PER_1M` | — | `0.15` |
| `ENV_DEV_APP_STORYBOARD_OUTPUT_COST_PER_1M` | — | `0.60` |
| `ENV_DEV_APP_STORYBOARD_SUMMARY_INPUT_COST_PER_1M` | no | `0.05` |
| `ENV_DEV_APP_STORYBOARD_SUMMARY_OUTPUT_COST_PER_1M` | no | `0.40` |
| `ENV_DEV_APP_RABBITMQ_VHOST` | — | `/` |
| `ENV_DEV_APP_RABBITMQ_REQUEST_EXCHANGE` | — | `ai.request` |
| `ENV_DEV_APP_RABBITMQ_RESULT_EXCHANGE` | — | `ai.result` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_QUEUE` | — | `ai.cpu.request.queue` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_QUEUE` | — | `ai.cpu.request.queue` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_ROUTING_KEY` | — | `ai.cpu.story.generate` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_ROUTING_KEY` | — | `ai.cpu.story.regenerate` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY` | — | `ai.result.story.generate.completed` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_FAILED_ROUTING_KEY` | — | `ai.result.story.generate.failed` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY` | — | `ai.result.story.regenerate.completed` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_FAILED_ROUTING_KEY` | — | `ai.result.story.regenerate.failed` |
| `ENV_DEV_APP_AI_WORKER_REPLICAS` | — | `1` (AI worker 컨테이너 복제본 수. compose `scale:` 키로 적용) |
| `ENV_DEV_APP_AI_TTS_STORY_WORKER_REPLICAS` | — | `1` (story TTS worker 컨테이너 복제본 수. compose `scale:` 키로 적용) |
| `ENV_DEV_APP_AI_TTS_PREVIEW_WORKER_REPLICAS` | — | `1` (preview TTS worker 컨테이너 복제본 수. compose `scale:` 키로 적용) |
| `ENV_DEV_APP_AI_WORKER_CONCURRENCY` | no | `3` |
| `ENV_DEV_APP_AI_STORY_API_CONCURRENCY` | no | `5` |
| `ENV_DEV_APP_AI_IMAGE_API_CONCURRENCY` | no | `20` |
| `ENV_DEV_APP_AI_GEMINI_IMAGE_API_CONCURRENCY` | no | `10` |
| `ENV_DEV_APP_AI_REPLICATE_IMAGE_API_CONCURRENCY` | no | `5` |
| `ENV_DEV_APP_RABBITMQ_PREFETCH_COUNT` | no | `10` |
| `ENV_DEV_APP_RABBITMQ_SENTENCE_TRANSLATE_QUEUE` | no | `ai.cpu.story.sentences.translate.request.queue` |
| `ENV_DEV_APP_RABBITMQ_SENTENCE_TRANSLATE_ROUTING_KEY` | no | `ai.cpu.story.sentences.translate` |
| `ENV_DEV_APP_RABBITMQ_SENTENCE_TRANSLATE_COMPLETED_ROUTING_KEY` | no | `ai.result.story.sentences.translate.completed` |
| `ENV_DEV_APP_RABBITMQ_SENTENCE_TRANSLATE_FAILED_ROUTING_KEY` | no | `ai.result.story.sentences.translate.failed` |

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
| `OAUTH_ALLOWED_REDIRECT_URIS` | `http://talemory.site:3001/auth/kakao/callback,https://talemory.site:3443/auth/kakao/callback` | `https://talemory.site/auth/kakao/callback` |
| `KAKAO_CLIENT_ID` | (dev Kakao REST API key) | (prod Kakao REST API key) |
| `VITE_KAKAO_CLIENT_ID` | (dev Kakao REST API key) | (prod Kakao REST API key) |
| `KAKAO_CLIENT_SECRET` | (dev Kakao client secret) | (prod Kakao client secret) |
| `FRONTEND_PORT` | `3001` | `80` |
| `MYSQL_PORT` | `3307` | `3306` |
| `REDIS_PORT` | `6380` | `6379` |
| `RABBITMQ_PORT` | `5673` | `5672` |
| `RABBITMQ_MANAGEMENT_PORT` | `15673` | `15672` |
| `AI_WORKER_REPLICAS` | `1` | `2` (권장 — 병렬 OpenAI 처리량 확보) |
| `AI_TTS_STORY_WORKER_REPLICAS` | `1` | `1` |
| `AI_TTS_PREVIEW_WORKER_REPLICAS` | `1` | `1` |
| `AI_WORKER_CONCURRENCY` | `3` | `3` |
| `AI_STORY_API_CONCURRENCY` | `5` | `5` |
| `AI_IMAGE_API_CONCURRENCY` | `20` | `20` |
| `AI_GEMINI_IMAGE_API_CONCURRENCY` | `10` | `10` |
| `AI_REPLICATE_IMAGE_API_CONCURRENCY` | `5` | `5` |
| `RABBITMQ_PREFETCH_COUNT` | `10` | `10` |
| `AWS_S3_ENV_PREFIX` | `dev` | `prod` |

Kakao Developers console registration guide:
- Redirect URI: `http://talemory.site:3001/auth/kakao/callback`, `https://talemory.site:3443/auth/kakao/callback`, `https://talemory.site/auth/kakao/callback`
- Frontend callback exchanges `{ code, redirectUri }` through `POST /api/auth/kakao/callback`; backend only accepts redirect URIs listed in `OAUTH_ALLOWED_REDIRECT_URIS`.

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
| `ENV_DEV_APP_STORYBOARD_SUMMARY_INPUT_COST_PER_1M` | no | `0.05` |
| `ENV_DEV_APP_STORYBOARD_SUMMARY_OUTPUT_COST_PER_1M` | no | `0.40` |
| `ENV_DEV_APP_RABBITMQ_VHOST` | no | `/` |
| `ENV_DEV_APP_RABBITMQ_REQUEST_EXCHANGE` | no | `ai.request` |
| `ENV_DEV_APP_RABBITMQ_RESULT_EXCHANGE` | no | `ai.result` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_QUEUE` | no | `ai.cpu.request.queue` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_QUEUE` | no | `ai.cpu.request.queue` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_ROUTING_KEY` | no | `ai.cpu.story.generate` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_ROUTING_KEY` | no | `ai.cpu.story.regenerate` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY` | no | `ai.result.story.generate.completed` |
| `ENV_DEV_APP_RABBITMQ_GENERATE_FAILED_ROUTING_KEY` | no | `ai.result.story.generate.failed` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY` | no | `ai.result.story.regenerate.completed` |
| `ENV_DEV_APP_RABBITMQ_REGENERATE_FAILED_ROUTING_KEY` | no | `ai.result.story.regenerate.failed` |
| `ENV_DEV_APP_RABBITMQ_SENTENCE_TRANSLATE_QUEUE` | no | `ai.cpu.story.sentences.translate.request.queue` |
| `ENV_DEV_APP_RABBITMQ_SENTENCE_TRANSLATE_ROUTING_KEY` | no | `ai.cpu.story.sentences.translate` |
| `ENV_DEV_APP_RABBITMQ_SENTENCE_TRANSLATE_COMPLETED_ROUTING_KEY` | no | `ai.result.story.sentences.translate.completed` |
| `ENV_DEV_APP_RABBITMQ_SENTENCE_TRANSLATE_FAILED_ROUTING_KEY` | no | `ai.result.story.sentences.translate.failed` |
| `ENV_DEV_APP_GEMINI_API_KEY` | yes | (Gemini API 키 — storyboard 이미지 생성) |
| `ENV_DEV_APP_STORYBOARD_IMAGE_MODEL` | no | `gemini-2.5-flash-image` |
| `ENV_DEV_APP_STORYBOARD_IMAGE_INPUT_COST_PER_1M` | no | `0.30` |
| `ENV_DEV_APP_STORYBOARD_IMAGE_OUTPUT_COST_PER_IMAGE` | no | `0.039` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_GENERATE_QUEUE` | no | `ai.image.generate.request.queue` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_GENERATE_ITEM_QUEUE` | no | `ai.image.generate.item.request.queue` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_REGENERATE_QUEUE` | no | `ai.image.regenerate.request.queue` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_GENERATE_ROUTING_KEY` | no | `ai.image.generate` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_GENERATE_ITEM_ROUTING_KEY` | no | `ai.image.generate.item` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_REGENERATE_ROUTING_KEY` | no | `ai.image.regenerate` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_GENERATE_COMPLETED_ROUTING_KEY` | no | `ai.result.image.generate.completed` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_GENERATE_FAILED_ROUTING_KEY` | no | `ai.result.image.generate.failed` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_REGENERATE_COMPLETED_ROUTING_KEY` | no | `ai.result.image.regenerate.completed` |
| `ENV_DEV_APP_RABBITMQ_IMAGE_REGENERATE_FAILED_ROUTING_KEY` | no | `ai.result.image.regenerate.failed` |
| `ENV_DEV_APP_FINAL_ILLUSTRATION_MODEL` | no | `black-forest-labs/flux-2-klein-9b` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_QUEUE` | no | `ai.final-illustration.generate.request.queue` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_QUEUE` | no | `ai.final-illustration.generate.item.request.queue` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_REVISE_QUEUE` | no | `ai.final-illustration.revise.request.queue` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ROUTING_KEY` | no | `ai.image.final-illustration.generate` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_ROUTING_KEY` | no | `ai.image.final-illustration.generate.item` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_REVISE_ROUTING_KEY` | no | `ai.image.final-illustration.revise` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_COMPLETED_ROUTING_KEY` | no | `ai.result.final-illustration.generate.completed` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_FAILED_ROUTING_KEY` | no | `ai.result.final-illustration.generate.failed` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_REVISE_COMPLETED_ROUTING_KEY` | no | `ai.result.final-illustration.revise.completed` |
| `ENV_DEV_APP_RABBITMQ_FINAL_ILLUSTRATION_REVISE_FAILED_ROUTING_KEY` | no | `ai.result.final-illustration.revise.failed` |
| `ENV_DEV_APP_RABBITMQ_TTS_PREVIEW_QUEUE` | no | `ai.gpu.preview.request.queue` |
| `ENV_DEV_APP_RABBITMQ_TTS_PREVIEW_ROUTING_KEY` | no | `ai.gpu.tts.preview` |
| `ENV_DEV_APP_AI_WORKER_REPLICAS` | no | `1` |
| `ENV_DEV_APP_AI_TTS_STORY_WORKER_REPLICAS` | no | `1` |
| `ENV_DEV_APP_AI_TTS_PREVIEW_WORKER_REPLICAS` | no | `1` |
| `ENV_DEV_APP_AI_WORKER_CONCURRENCY` | no | `3` |
| `ENV_DEV_APP_AI_STORY_API_CONCURRENCY` | no | `5` |
| `ENV_DEV_APP_AI_IMAGE_API_CONCURRENCY` | no | `20` |
| `ENV_DEV_APP_AI_GEMINI_IMAGE_API_CONCURRENCY` | no | `10` |
| `ENV_DEV_APP_AI_REPLICATE_IMAGE_API_CONCURRENCY` | no | `5` |
| `ENV_DEV_APP_RABBITMQ_PREFETCH_COUNT` | no | `10` |

### MASTER APP (AI 출처)

| Key | Masked | Example |
|---|---|---|
| `ENV_MASTER_APP_PROJECT_NAME` | no | `S210 AI API` |
| `ENV_MASTER_APP_APP_VERSION` | no | `0.1.0` |
| `ENV_MASTER_APP_ENVIRONMENT` | no | `master` |
| `ENV_MASTER_APP_STORYBOARD_MODEL` | no | `gpt-4o-mini` |
| `ENV_MASTER_APP_STORYBOARD_INPUT_COST_PER_1M` | no | `0.15` |
| `ENV_MASTER_APP_STORYBOARD_OUTPUT_COST_PER_1M` | no | `0.60` |
| `ENV_MASTER_APP_STORYBOARD_SUMMARY_INPUT_COST_PER_1M` | no | `0.05` |
| `ENV_MASTER_APP_STORYBOARD_SUMMARY_OUTPUT_COST_PER_1M` | no | `0.40` |
| `ENV_MASTER_APP_RABBITMQ_VHOST` | no | `/` |
| `ENV_MASTER_APP_RABBITMQ_REQUEST_EXCHANGE` | no | `ai.request` |
| `ENV_MASTER_APP_RABBITMQ_RESULT_EXCHANGE` | no | `ai.result` |
| `ENV_MASTER_APP_RABBITMQ_GENERATE_QUEUE` | no | `ai.cpu.request.queue` |
| `ENV_MASTER_APP_RABBITMQ_REGENERATE_QUEUE` | no | `ai.cpu.request.queue` |
| `ENV_MASTER_APP_RABBITMQ_GENERATE_ROUTING_KEY` | no | `ai.cpu.story.generate` |
| `ENV_MASTER_APP_RABBITMQ_REGENERATE_ROUTING_KEY` | no | `ai.cpu.story.regenerate` |
| `ENV_MASTER_APP_RABBITMQ_GENERATE_COMPLETED_ROUTING_KEY` | no | `ai.result.story.generate.completed` |
| `ENV_MASTER_APP_RABBITMQ_GENERATE_FAILED_ROUTING_KEY` | no | `ai.result.story.generate.failed` |
| `ENV_MASTER_APP_RABBITMQ_REGENERATE_COMPLETED_ROUTING_KEY` | no | `ai.result.story.regenerate.completed` |
| `ENV_MASTER_APP_RABBITMQ_REGENERATE_FAILED_ROUTING_KEY` | no | `ai.result.story.regenerate.failed` |
| `ENV_MASTER_APP_RABBITMQ_SENTENCE_TRANSLATE_QUEUE` | no | `ai.cpu.story.sentences.translate.request.queue` |
| `ENV_MASTER_APP_RABBITMQ_SENTENCE_TRANSLATE_ROUTING_KEY` | no | `ai.cpu.story.sentences.translate` |
| `ENV_MASTER_APP_RABBITMQ_SENTENCE_TRANSLATE_COMPLETED_ROUTING_KEY` | no | `ai.result.story.sentences.translate.completed` |
| `ENV_MASTER_APP_RABBITMQ_SENTENCE_TRANSLATE_FAILED_ROUTING_KEY` | no | `ai.result.story.sentences.translate.failed` |
| `ENV_MASTER_APP_GEMINI_API_KEY` | yes | (prod Gemini API 키 — storyboard 이미지 생성) |
| `ENV_MASTER_APP_STORYBOARD_IMAGE_MODEL` | no | `gemini-2.5-flash-image` |
| `ENV_MASTER_APP_STORYBOARD_IMAGE_INPUT_COST_PER_1M` | no | `0.30` |
| `ENV_MASTER_APP_STORYBOARD_IMAGE_OUTPUT_COST_PER_IMAGE` | no | `0.039` |
| `ENV_MASTER_APP_RABBITMQ_IMAGE_GENERATE_QUEUE` | no | `ai.image.generate.request.queue` |
| `ENV_MASTER_APP_RABBITMQ_IMAGE_GENERATE_ITEM_QUEUE` | no | `ai.image.generate.item.request.queue` |
| `ENV_MASTER_APP_RABBITMQ_IMAGE_REGENERATE_QUEUE` | no | `ai.image.regenerate.request.queue` |
| `ENV_MASTER_APP_RABBITMQ_IMAGE_GENERATE_ROUTING_KEY` | no | `ai.image.generate` |
| `ENV_MASTER_APP_RABBITMQ_IMAGE_GENERATE_ITEM_ROUTING_KEY` | no | `ai.image.generate.item` |
| `ENV_MASTER_APP_RABBITMQ_IMAGE_REGENERATE_ROUTING_KEY` | no | `ai.image.regenerate` |
| `ENV_MASTER_APP_RABBITMQ_IMAGE_GENERATE_COMPLETED_ROUTING_KEY` | no | `ai.result.image.generate.completed` |
| `ENV_MASTER_APP_RABBITMQ_IMAGE_GENERATE_FAILED_ROUTING_KEY` | no | `ai.result.image.generate.failed` |
| `ENV_MASTER_APP_RABBITMQ_IMAGE_REGENERATE_COMPLETED_ROUTING_KEY` | no | `ai.result.image.regenerate.completed` |
| `ENV_MASTER_APP_RABBITMQ_IMAGE_REGENERATE_FAILED_ROUTING_KEY` | no | `ai.result.image.regenerate.failed` |
| `ENV_MASTER_APP_FINAL_ILLUSTRATION_MODEL` | no | `black-forest-labs/flux-2-klein-9b` |
| `ENV_MASTER_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_QUEUE` | no | `ai.final-illustration.generate.request.queue` |
| `ENV_MASTER_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_QUEUE` | no | `ai.final-illustration.generate.item.request.queue` |
| `ENV_MASTER_APP_RABBITMQ_FINAL_ILLUSTRATION_REVISE_QUEUE` | no | `ai.final-illustration.revise.request.queue` |
| `ENV_MASTER_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ROUTING_KEY` | no | `ai.image.final-illustration.generate` |
| `ENV_MASTER_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ITEM_ROUTING_KEY` | no | `ai.image.final-illustration.generate.item` |
| `ENV_MASTER_APP_RABBITMQ_FINAL_ILLUSTRATION_REVISE_ROUTING_KEY` | no | `ai.image.final-illustration.revise` |
| `ENV_MASTER_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_COMPLETED_ROUTING_KEY` | no | `ai.result.final-illustration.generate.completed` |
| `ENV_MASTER_APP_RABBITMQ_FINAL_ILLUSTRATION_GENERATE_FAILED_ROUTING_KEY` | no | `ai.result.final-illustration.generate.failed` |
| `ENV_MASTER_APP_RABBITMQ_FINAL_ILLUSTRATION_REVISE_COMPLETED_ROUTING_KEY` | no | `ai.result.final-illustration.revise.completed` |
| `ENV_MASTER_APP_RABBITMQ_FINAL_ILLUSTRATION_REVISE_FAILED_ROUTING_KEY` | no | `ai.result.final-illustration.revise.failed` |
| `ENV_MASTER_APP_RABBITMQ_TTS_PREVIEW_QUEUE` | no | `ai.gpu.preview.request.queue` |
| `ENV_MASTER_APP_RABBITMQ_TTS_PREVIEW_ROUTING_KEY` | no | `ai.gpu.tts.preview` |
| `ENV_MASTER_APP_AI_WORKER_REPLICAS` | no | `2` |
| `ENV_MASTER_APP_AI_TTS_STORY_WORKER_REPLICAS` | no | `1` |
| `ENV_MASTER_APP_AI_TTS_PREVIEW_WORKER_REPLICAS` | no | `1` |
| `ENV_MASTER_APP_AI_WORKER_CONCURRENCY` | no | `3` |
| `ENV_MASTER_APP_AI_STORY_API_CONCURRENCY` | no | `5` |
| `ENV_MASTER_APP_AI_IMAGE_API_CONCURRENCY` | no | `20` |
| `ENV_MASTER_APP_AI_GEMINI_IMAGE_API_CONCURRENCY` | no | `10` |
| `ENV_MASTER_APP_AI_REPLICATE_IMAGE_API_CONCURRENCY` | no | `5` |
| `ENV_MASTER_APP_RABBITMQ_PREFETCH_COUNT` | no | `10` |
