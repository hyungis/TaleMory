# TaleMory

가족의 여행 사진과 목소리로 만드는 AI 영어 동화책 서비스.

## 1. 프로젝트 소개

TaleMory(`talemory.site`) 는 사용자가 업로드한 가족 사진과 여행 메타데이터를 바탕으로 OpenAI · Google Gemini · Replicate · Qwen TTS 등 다중 AI 파이프라인을 통해 **영어 동화책 1권 + 한국어 번역 + 가족 목소리 음성**을 자동 생성하는 서비스이다.

- **사용자 가치**: 여행 기록 → 잊혀가는 추억을 AI 동화책으로 보존 + 자녀 영어 학습 보조
- **차별점**
  - **음성 클로닝**: 사용자의 짧은 reference 녹음으로 동화 본문 전체를 본인 목소리로 합성
  - **2가지 뷰어 모드**: 종이 동화책 / 웹툰 (말풍선 + 캐릭터 좌표 anchor)
  - **단계별 미리보기 + 페이지 단위 재생성**: 한 권 통째 다시 만들 필요 없음
  - **공유 토큰**: 비로그인 사용자에게도 동화책 공개 가능

## 2. 기술 스택

| 영역 | 스택 |
|---|---|
| Frontend | React 19 · Vite 7 · TypeScript 5 · Tailwind CSS 4 · @tanstack/react-query 5 · Three.js |
| Backend | Spring Boot 4 · Kotlin (DDD) · JPA + Flyway · Spring Security (JWT) · Sqids ID 인코딩 |
| AI Worker | Python 3.11 · FastAPI (legacy) + RabbitMQ consumer · OpenAI · Google Gemini · Replicate · Qwen TTS |
| 메시징 | RabbitMQ 3 (topic exchange `ai.request` / `ai.result` + fan-out) |
| 데이터 | MySQL 8.4 · Redis 7 · AWS S3 |
| 인프라 | Docker · docker compose · nginx · Let's Encrypt · GitLab CI/CD |
| 인증 | Kakao OAuth 2.0 · JWT (access + refresh 분리) |

## 3. 폴더 구조

```
S14P31S210/
├── app/
│   ├── backend/                       # Spring Boot 4 + Kotlin DDD API
│   │   └── src/main/kotlin/com/s210/backend
│   │       ├── common/                # 공용 (codec, exception, s3, redis, mq)
│   │       └── domain/                # auth, story, storyboard, tts, voice, job ...
│   ├── frontend/                      # React 19 + Vite
│   │   └── src
│   │       ├── app/                   # 라우터 + provider
│   │       ├── features/              # 기능 단위 (auth, story-creation/*, viewer/*, mypage, ...)
│   │       ├── pages/                 # 라우트 진입점 (home, main, creation, viewer, mypage, about)
│   │       ├── shared/                # 공용 (api, types, constants, ui)
│   │       └── entities/              # 도메인 엔티티 타입
│   └── ai/                            # Python AI 워커 (RabbitMQ consumer)
│       ├── app/
│       │   ├── consumers/             # 잡 타입별 consumer (storyboard, image, tts, final_illustration, layout)
│       │   ├── services/              # OpenAI / Gemini / Replicate / Qwen 클라이언트
│       │   └── schemas/               # MQ 메시지 Pydantic 모델
│       ├── worker.py                  # CPU consumer (storyboard, image, final illustration)
│       ├── worker_tts_story.py        # GPU consumer (본문 TTS)
│       └── worker_tts_preview.py      # GPU consumer (voice clone preview)
├── infra/
│   ├── compose/                       # docker-compose.{app,infra}-{local,dev,master}.yml
│   ├── docker/                        # frontend.Dockerfile (multi-stage build + nginx)
│   ├── nginx/                         # nginx.{common,local,dev,prod}.conf
│   ├── env/                           # *.env.example + README (GitLab Variables 매핑)
│   └── scripts/                       # build / deploy / health-check / notify
├── docs/                              # CI/CD 흐름, 로컬 가이드, env 매핑, 컨벤션
├── exec/                              # 산출물 (포팅 매뉴얼, 외부 서비스, 시연 시나리오, dump.sql)
└── .gitlab/                           # GitLab CI 분할 파이프라인
```

## 4. 빠른 시작 (로컬)

### 4.1 사전 요구
- Docker Desktop (또는 Linux Docker + Compose v2)
- Git Bash (Windows) 또는 bash 셸
- Node.js 20+ + pnpm 9+ (FE 직접 dev 시)
- Java 21 (BE 직접 dev 시)
- Python 3.11+ (AI 워커 직접 dev 시)

### 4.2 env 파일 복사
```bash
cp infra/env/app.local.env.example   infra/env/app.local.env
cp infra/env/infra.local.env.example infra/env/infra.local.env
```

비밀키 / API 키 필요한 값 채우기:
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `REPLICATE_API_TOKEN`
- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `QWEN_TTS_SERVER_URL` (외부 GPU 서버 endpoint)

### 4.3 기동 (2단계, infra 먼저)
```bash
alias dci='docker compose -f infra/compose/docker-compose.infra-local.yml'
alias dca='docker compose -f infra/compose/docker-compose.app-local.yml'

dci up -d                # MySQL / Redis / RabbitMQ
dci ps                   # mysql Up (healthy) 확인
dca up -d --build        # nginx / backend / ai 워커
```

### 4.4 접속
- 브라우저: `http://localhost:3001`
- Backend: `http://localhost:8081` (`/api/health` → 200 OK)
- RabbitMQ UI: `http://localhost:15673` (rabbit / rabbitpass)
- MySQL: `localhost:3307` (app / apppass)
- Redis: `localhost:6380` (redispass)

자세한 로컬 개발 가이드는 [docs/local-dev.md](docs/local-dev.md) 참고.

## 5. 운영 배포

GitLab CI (`.gitlab-ci.yml`) 가 `dev` / `master` 브랜치 push 를 받아 자동 배포한다.

```
generate_env → deploy_infra (조건부) → verify_infra → build (3 병렬) → deploy → health-check → notify
```

- **Registry 미사용**: SSAFY GitLab Container Registry 비활성이라 project runner(=배포 서버) docker daemon 안에서 빌드 → 그 자리에서 compose 가 씀
- **이미지 태그**: `$CI_COMMIT_SHORT_SHA` (immutable)
- **자동 rollback 없음**: 실패 시 `git revert` 또는 `APP_IMAGE_TAG=<prev_sha>` override 재실행

자세한 흐름은 [docs/ci-cd-pipeline-flow.md](docs/ci-cd-pipeline-flow.md) 참고.

## 6. 동화 생성 9단계 (서비스 흐름 요약)

1. **기본 정보** — 주인공/가족/여행 일정/장소 + 모드 선택 (책 / 웹툰)
2. **사진 업로드** — 가족 멤버 사진 + 추억 사진 + 대표 표지 (presigned S3 PUT)
3. **줄거리** — AI 가 입력 메타로 synopsis 생성
4. **스토리보드** — 페이지별 영문 + 한글 본문 + 라프 일러스트
5. **그림 스타일** — 동화책 그림체 프리셋 선택 → FINAL_ILLUSTRATION 잡 백그라운드 발행
6. **목소리** — voice clone reference 등록 / 선택
7. **하이라이트 / 마무리** — 강조 문장 사용자 녹음 + 마무리 멘트
8. **최종 미리보기** — 완성된 동화 전체 확인 (페이지 단위 재생성 가능)
9. **발행** — `Story.status=PUBLISHED` + 공유 토큰 발급

## 7. 핵심 외부 서비스

| 서비스 | 용도 |
|---|---|
| Kakao OAuth | 사용자 로그인 |
| OpenAI (gpt-4o-mini, gpt-5-nano) | 본문 / 요약 / 번역 생성 |
| Google Gemini Vision | 스토리보드 이미지 + 웹툰 좌표 추출 |
| Replicate (FLUX) | 최종 일러스트 생성 |
| Qwen TTS Server | 사용자 음성 클로닝 TTS |
| AWS S3 | 이미지/오디오/일러스트 저장 |
| RabbitMQ | BE ↔ AI 워커 비동기 메시징 |
| MySQL / Redis | 메인 RDB / 캐시 + 잡 상태 |

세부 매핑은 [exec/EXTERNAL_SERVICE.md](exec/EXTERNAL_SERVICE.md) 참고.

## 8. 문서 인덱스

| 문서 | 용도 |
|---|---|
| [exec/PORTING_MANUAL.md](exec/PORTING_MANUAL.md) | 신규 서버 포팅 전체 절차 |
| [exec/EXTERNAL_SERVICE.md](exec/EXTERNAL_SERVICE.md) | 외부 서비스 / 환경변수 카탈로그 |
| [exec/DEMO_SCENARIO.md](exec/DEMO_SCENARIO.md) | 시연 동선 (20단계) |
| [docs/local-dev.md](docs/local-dev.md) | 로컬 개발 환경 셋업 |
| [docs/ci-cd-pipeline-flow.md](docs/ci-cd-pipeline-flow.md) | GitLab CI/CD 파이프라인 흐름 |
| [docs/gitlab-variables.md](docs/gitlab-variables.md) | GitLab Variables 명명 규칙 + env 매핑 |
| [docs/local-commands.md](docs/local-commands.md) | 자주 쓰는 docker compose 명령 모음 |
| [infra/README.md](infra/README.md) | 인프라 코드 구조 + 컨테이너/포트 레이아웃 |
| [infra/env/README.md](infra/env/README.md) | env 파일 변환 규칙 |
| [infra/scripts/README.md](infra/scripts/README.md) | 배포 스크립트 카탈로그 |

## 9. 라이선스 / 팀

SSAFY 14기 자율 프로젝트 S14P31S210.
