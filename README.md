# TaleMory

> 가족의 여행 사진과 목소리로 만드는 AI 영어 동화책 서비스

사용자가 업로드한 가족 사진과 여행 메타데이터를 바탕으로 OpenAI · Google Gemini · Replicate · Qwen TTS 등 다중 AI 파이프라인을 통해 **영어 동화책 1권 + 한국어 번역 + 가족 목소리 음성**을 자동 생성하는 서비스입니다.

---

## 📑 목차

1. [프로젝트 소개](#-프로젝트-소개)
2. [주요 기능](#-주요-기능)
3. [기술 스택](#️-기술-스택)
4. [프로젝트 구조](#-프로젝트-구조)
5. [아키텍처](#️-아키텍처)
6. [설치 및 실행 방법](#️-설치-및-실행-방법)

---

## 📋 프로젝트 소개

**TaleMory**(`talemory.site`)는 SSAFY(삼성 청년 SW 아카데미) 14기 자율 프로젝트로 개발된 AI 영어 동화책 생성 서비스입니다.

가족과 함께한 여행 사진을 업로드하면, AI가 사진 속 인물과 장소를 분석하여 영어 동화 스토리를 자동으로 만들어 줍니다. 생성된 동화는 **책 모드**와 **웹툰 모드** 두 가지 뷰어로 감상할 수 있으며, 사용자의 목소리를 클로닝하여 동화를 읽어주는 음성까지 제공합니다.

- **사용자 가치**: 잊혀가는 여행 추억을 AI 동화책으로 보존 + 자녀 영어 학습 보조
- **차별점**
  - **음성 클로닝**: 사용자의 짧은 녹음으로 동화 본문 전체를 본인 목소리로 합성
  - **2가지 뷰어 모드**: 종이 동화책 / 웹툰 (말풍선 + 캐릭터 좌표 anchor)
  - **단계별 미리보기 + 페이지 단위 재생성**: 한 권 통째 다시 만들 필요 없음
  - **공유 토큰**: 비로그인 사용자에게도 동화책 공개 가능

---

## 🚀 주요 기능

### 랜딩 & 메인 화면

3D 숲 씬으로 구성된 랜딩 페이지에서 집/책장 입구를 클릭하여 메인 화면으로 진입합니다.

![랜딩 페이지](exec/img/01_landing.png)
![메인 화면](exec/img/02_main.png)

### Kakao 로그인

Kakao OAuth 2.0 기반 간편 로그인을 지원합니다. 로그인 후 JWT 토큰이 발급되어 서비스 전체에서 인증이 유지됩니다.

![Kakao 로그인](exec/img/03_kakao_login.png)

### 책장 (Bookshelf)

발행된 동화책 목록을 확인하고, 새로운 동화를 만들 수 있는 책장 모달입니다.

![책장 모달](exec/img/04_bookshelf.png)

### Step 1 — 기본 정보 입력

주인공 이름, 함께한 사람, 여행 일정, 장소를 입력하고 동화 모드(일반 동화책 / 웹툰)를 선택합니다.

![기본 정보 입력](exec/img/05_creation_step1.png)

### Step 2 — 사진 업로드

가족 멤버 사진(인물 식별용), 추억 사진(스토리 소스), 대표 표지 후보를 업로드합니다. presigned PUT으로 S3에 직접 업로드됩니다.

![사진 업로드](exec/img/06_creation_step2.png)

### Step 3 — 줄거리 (Synopsis)

AI가 입력된 메타데이터를 바탕으로 줄거리를 자동 생성합니다. 사용자가 직접 수정할 수 있습니다.

![줄거리 생성](exec/img/07_creation_step3.png)
![줄거리 수정](exec/img/07_creation_step3-1.png)

### Step 4 — 스토리보드 편집

페이지별 영문/한글 본문과 라프 일러스트를 확인하고, 필요 시 페이지 단위로 재생성할 수 있습니다.

![스토리보드](exec/img/08_creation_step4.png)
![스토리보드 편집 1](exec/img/08_creation_step4-1.png)
![스토리보드 편집 2](exec/img/08_creation_step4-2.png)
![스토리보드 편집 3](exec/img/08_creation_step4-3.png)

### Step 5 — 그림 스타일 선택

동화책 그림체 프리셋을 선택하면 백그라운드에서 최종 일러스트 생성이 시작됩니다.

![그림 스타일 선택](exec/img/09_creation_step5.png)

### Step 6 — 목소리 준비 (Voice Clone)

마이페이지에 등록된 voice profile을 선택하거나, 새로운 reference 녹음을 등록합니다. 미리듣기로 클로닝 결과를 확인할 수 있습니다.

![목소리 선택](exec/img/10_creation_step6.png)
![목소리 녹음](exec/img/10_creation_step6-1.png)

### Step 7 — 하이라이트 & 마무리

강조해서 읽을 문장을 선택하여 직접 녹음하고, 마무리 멘트를 입력합니다.

![하이라이트 녹음](exec/img/11_creation_step7.png)
![마무리 멘트](exec/img/11_creation_step7-1.png)

### Step 8 — 최종 미리보기

완성된 동화 전체 흐름을 확인합니다. 일러스트 재생성(페이지 단위)이 가능합니다.

![최종 미리보기](exec/img/12_creation_step8.png)

### Step 9 — 동화 발행

발행 버튼을 클릭하면 동화가 공개되고 공유 토큰이 발급됩니다.

![동화 발행](exec/img/13_creation_step9.png)

### 발행된 동화 확인 & 공유 링크

책장에서 발행된 동화를 확인하고, 공유 링크를 통해 친구/가족에게 전달할 수 있습니다.

![발행된 동화 확인](exec/img/14_bookshelf_published.png)
![공유 링크](exec/img/15_invitation.png)

### 책 모드 뷰어 (StoryBookViewer)

좌/우 화살표로 페이지를 넘기며 동화를 감상합니다. 음성 재생, 번역 토글, 글자 크기 조절, 책갈피 기능을 제공합니다.

![책 모드 뷰어 1](exec/img/16_book_viewer.jpg)
![책 모드 뷰어 2](exec/img/16_book_viewer.png)

### 웹툰 모드 뷰어 (StoryWebtoonViewer)

세로 스크롤로 진행하며, 말풍선이 Gemini Vision이 추출한 캐릭터 좌표 기준으로 배치됩니다. 페이지별 음성 재생을 지원합니다.

![웹툰 뷰어 1](exec/img/17_webtoon_viewer.png)
![웹툰 뷰어 2](exec/img/17_webtoon_viewer1.png)

### 마이페이지

프로필 확인, 가족 멤버 관리, voice profile 관리를 할 수 있습니다.

![마이페이지 1](exec/img/19_mypage.png)
![마이페이지 2](exec/img/19_mypage1.png)

### 보이스 클론 추가

reference 녹음을 업로드하고 preview TTS로 결과를 확인한 뒤 저장합니다.

![보이스 클론 추가 1](exec/img/20_voice_clone_add.png)
![보이스 클론 추가 2](exec/img/20_voice_clone_add1.png)

---

## 🛠️ 기술 스택

| 영역 | 스택 |
|---|---|
| Frontend | React 19 · Vite 7 · TypeScript 5 · Tailwind CSS 4 · @tanstack/react-query 5 · Three.js |
| Backend | Spring Boot 4 · Kotlin (DDD) · JPA + Flyway · Spring Security (JWT) · Sqids ID 인코딩 |
| AI Worker | Python 3.11 · FastAPI (legacy) + RabbitMQ consumer · OpenAI · Google Gemini · Replicate · Qwen TTS |
| 메시징 | RabbitMQ 3 (topic exchange `ai.request` / `ai.result` + fan-out) |
| 데이터 | MySQL 8.4 · Redis 7 · AWS S3 |
| 인프라 | Docker · docker compose · nginx · Let's Encrypt · GitLab CI/CD |
| 인증 | Kakao OAuth 2.0 · JWT (access + refresh 분리) |

---

## 📂 프로젝트 구조

### 📦 Frontend

```
app/frontend/src/
├── app/                           # 라우터 + provider
├── features/                      # 기능 단위
│   ├── auth/                      # 인증 (Kakao OAuth)
│   ├── story-creation/            # 동화 생성 9단계
│   ├── viewer/                    # 뷰어 (책 모드 / 웹툰 모드)
│   └── mypage/                    # 마이페이지
├── pages/                         # 라우트 진입점 (home, main, creation, viewer, mypage, about)
├── shared/                        # 공용 (api, types, constants, ui)
└── entities/                      # 도메인 엔티티 타입
```

### 🖥️ Backend

```
app/backend/src/main/kotlin/com/s210/backend/
├── common/                        # 공용 (codec, exception, s3, redis, mq)
└── domain/                        # DDD 도메인 레이어
    ├── auth/                      # 인증 (Kakao OAuth + JWT)
    ├── story/                     # 동화 CRUD + 발행
    ├── storyboard/                # 스토리보드 (페이지별 본문 + 이미지)
    ├── tts/                       # TTS 음성 생성
    ├── voice/                     # 음성 클로닝 프로필
    └── job/                       # 비동기 잡 관리
```

### 🤖 AI Worker

```
app/ai/
├── app/
│   ├── consumers/                 # 잡 타입별 consumer
│   │   ├── storyboard_consumer    # 스토리보드 본문 생성 (OpenAI)
│   │   ├── storyboard_image_consumer  # 라프 일러스트 (Gemini Vision)
│   │   ├── final_illustration_consumer  # 최종 일러스트 (Replicate FLUX)
│   │   └── tts_consumer           # TTS 음성 합성 (Qwen)
│   ├── services/                  # AI 클라이언트 (OpenAI / Gemini / Replicate / Qwen)
│   └── schemas/                   # MQ 메시지 Pydantic 모델
├── worker.py                      # CPU consumer (storyboard, image, final illustration)
├── worker_tts_story.py            # GPU consumer (본문 TTS)
└── worker_tts_preview.py          # GPU consumer (voice clone preview)
```

### 🏗️ Infrastructure

```
infra/
├── compose/                       # docker-compose.{app,infra}-{local,dev,master}.yml
├── docker/                        # frontend.Dockerfile (multi-stage build + nginx)
├── nginx/                         # nginx.{common,local,dev,prod}.conf
├── env/                           # *.env.example + README (GitLab Variables 매핑)
└── scripts/                       # build / deploy / health-check / notify
```

---

## 🏗️ 아키텍처

![아키텍처](exec/img/자율_아키텍처.png)

### 비동기 잡 흐름

| 단계 | 발행 잡 | 처리 워커 | AI 모델 |
|---|---|---|---|
| Step 4 스토리보드 생성 | `ai.cpu.story.generate` | ai-worker | OpenAI gpt-4o-mini |
| Step 4 페이지 재생성 | `ai.image.regenerate` | ai-worker | Gemini Vision |
| Step 5 최종 일러스트 | `ai.image.final-illustration.generate` | ai-worker | Replicate FLUX |
| Step 5 웹툰 레이아웃 | `ai.image.final-illustration.layout` | ai-worker | Gemini Vision |
| Step 7→8 TTS 생성 | `ai.gpu.tts.generate` | ai-tts-story-worker | Qwen TTS |
| Voice Clone Preview | `ai.gpu.tts.preview` | ai-tts-preview-worker | Qwen TTS |

---

## ⚙️ 설치 및 실행 방법

### 사전 요구 사항

- Docker Desktop (또는 Linux Docker + Compose v2)
- Git Bash (Windows) 또는 bash 셸
- Node.js 20+ + pnpm 9+ (FE 직접 dev 시)
- Java 21 (BE 직접 dev 시)
- Python 3.11+ (AI 워커 직접 dev 시)

### env 파일 복사

```bash
cp infra/env/app.local.env.example   infra/env/app.local.env
cp infra/env/infra.local.env.example infra/env/infra.local.env
```

비밀키 / API 키 필요한 값 채우기:
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `REPLICATE_API_TOKEN`
- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `QWEN_TTS_SERVER_URL` (외부 GPU 서버 endpoint)

### Docker Compose로 전체 실행

> 상세한 배포 및 설정 방법은 [포팅 매뉴얼](exec/PORTING_MANUAL.md)을 참고하세요.

```bash
alias dci='docker compose -f infra/compose/docker-compose.infra-local.yml'
alias dca='docker compose -f infra/compose/docker-compose.app-local.yml'

# 1단계: 인프라 기동
dci up -d                # MySQL / Redis / RabbitMQ
dci ps                   # mysql Up (healthy) 확인

# 2단계: 애플리케이션 기동
dca up -d --build        # nginx / backend / ai 워커
```

### 접속 정보

| 서비스 | 포트 | 설명 |
|---|---|---|
| Frontend (nginx) | 3001 | 웹 애플리케이션 (`http://localhost:3001`) |
| Backend (Spring Boot) | 8081 | REST API (`/api/health` → 200 OK) |
| RabbitMQ UI | 15673 | 관리 콘솔 (rabbit / rabbitpass) |
| MySQL | 3307 | 데이터베이스 (app / apppass) |
| Redis | 6380 | 캐시 서버 (redispass) |

### 로컬 개발 환경 (개별 실행)

**Backend**

```bash
cd app/backend
./gradlew bootRun
```

**Frontend**

```bash
cd app/frontend
pnpm install
pnpm dev
```

**AI Worker**

```bash
cd app/ai
pip install -r requirements.txt
python worker.py
```

자세한 로컬 개발 가이드는 [docs/local-dev.md](docs/local-dev.md) 참고.

---

## 📚 문서 인덱스

| 문서 | 용도 |
|---|---|
| [exec/PORTING_MANUAL.md](exec/PORTING_MANUAL.md) | 신규 서버 포팅 전체 절차 |
| [exec/EXTERNAL_SERVICE.md](exec/EXTERNAL_SERVICE.md) | 외부 서비스 / 환경변수 카탈로그 |
| [exec/DEMO_SCENARIO.md](exec/DEMO_SCENARIO.md) | 시연 동선 (20단계) |
| [docs/local-dev.md](docs/local-dev.md) | 로컬 개발 환경 셋업 |
| [docs/ci-cd-pipeline-flow.md](docs/ci-cd-pipeline-flow.md) | GitLab CI/CD 파이프라인 흐름 |
| [docs/gitlab-variables.md](docs/gitlab-variables.md) | GitLab Variables 명명 규칙 + env 매핑 |
| [infra/README.md](infra/README.md) | 인프라 코드 구조 + 컨테이너/포트 레이아웃 |

---

SSAFY 14기 자율 프로젝트 S14P31S210.
