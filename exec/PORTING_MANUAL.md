# PORTING MANUAL

본 문서는 `S14P31S210` (TaleMory) 프로젝트를 신규 서버/PC 환경에 이식(포팅)할 때 필요한 실행 절차를 정리한다.
기준일: 2026-05-14

## 1. 프로젝트 개요
- 프로젝트명: **TaleMory (다정한 추억)**
- 목적: 가족 여행 사진과 음성으로 만드는 AI 영어 동화책 — 메모리(추억) + AI 그림체/TTS/번역 결합
- 도메인: `talemory.site` (운영), `k14s210.p.ssafy.io` (SSAFY)
- 저장소 주요 모듈
  - `app/backend`: Spring Boot 4 + Kotlin DDD API 서버
  - `app/frontend`: React 19 + Vite + Tailwind 4 웹 클라이언트
  - `app/ai`: FastAPI + RabbitMQ consumer (storyboard / image / TTS / final illustration / layout 잡 처리)
  - `infra`: compose / nginx / env / scripts (운영 인프라 코드)
  - `exec`: 실행 참고 산출물 (`dump.sql`, 본 문서 등)

## 2. 시스템 구성 요약
- Frontend(React) — nginx 컨테이너에 정적 산출물 + 리버스 프록시
- Backend(Spring Boot) — Kotlin DDD 구조, JPA + Flyway 자동 마이그레이션
- AI Worker — 항시 상주 RabbitMQ consumer (FastAPI 가 아닌 worker.py 직접 실행)
  - `ai-worker` (CPU 잡: storyboard 생성, sentence 번역, 이미지 생성, 최종 삽화)
  - `ai-tts-story-worker` (GPU 잡: 본문 TTS)
  - `ai-tts-preview-worker` (GPU 잡: voice clone preview TTS)
- 비동기 메시징: RabbitMQ topic exchange (`ai.request` / `ai.result`)
- 캐시/잡 상태: Redis (TTL 기반 polling 응답 캐시, illustration version 등)
- OAuth: Kakao 소셜 로그인 + JWT (access/refresh 분리)
- TTS: Qwen TTS server (voice clone) — 외부 GPU 서버 HTTP 호출
- 이미지 생성: Google Gemini Vision (storyboard / final illustration / layout 좌표 추출)
- 객체 저장: AWS S3 (이미지 / 오디오 / 일러스트 버전)

## 3. 포팅 대상 환경
### 3.1 권장 런타임
- **Java 21** (Spring Boot 4)
- **Node.js 20+** + **pnpm 9+**
- **Python 3.11+** (AI 워커)
- **MySQL 8.4**
- **Redis 7**
- **RabbitMQ 3.x** (management plugin 포함)
- **Docker / Docker Compose v2**

### 3.2 OS
- Linux 운영 서버 (Ubuntu 22.04 LTS 기준)
- Windows 10/11 + Docker Desktop + Git Bash 로컬 개발
- 본 문서 명령어는 Linux/Bash 기준으로 작성

## 4. 사전 준비
### 4.1 소스 준비
```bash
git clone <repository-url>
cd S14P31S210
```

### 4.2 Tailscale 메시 가입 (운영 서버 + GPU 서버 공통)
운영/개발 서버는 외부 GPU 서버(Qwen TTS) 와 Tailscale 메시 VPN 으로 연결되어야 한다. Qwen TTS 서버는 인터넷에 직접 노출되지 않고 100.64.x.x (Tailscale CGNAT) IP 로만 접근 가능.

```bash
# Ubuntu 기준 (운영 서버)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --authkey=tskey-auth-xxxxxxxx   # 운영팀에서 발급
sudo systemctl enable tailscaled

# 도달 확인
tailscale status
ping 100.64.201.34                                 # 또는 실제 Qwen 노드 IP
```

> Qwen TTS 서버도 같은 tailnet 가입 필수. ACL 로 `ai-worker` 노드만 8091 포트 허용 권장.

### 4.3 환경 변수
환경 변수 값(.env 및 OS 환경변수)은 이미 별도 관리 중이라는 전제로 작성한다. 운영은 GitLab CI/CD Variables 에서 주입.

포팅 시 아래 키들이 누락되지 않았는지만 점검한다.
- **Backend 핵심**: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SPRING_PROFILES_ACTIVE`
- **OAuth (Kakao)**: `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `OAUTH_ALLOWED_REDIRECT_URIS`
- **Email 인증**: `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`
- **Frontend**: `VITE_API_BASE_URL`, `VITE_KAKAO_CLIENT_ID`
- **AI 서비스**: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `REPLICATE_API_TOKEN`, `QWEN_TTS_SERVER_URL`
- **AWS S3**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_S3_ENV_PREFIX`, `AWS_S3_PREFIX`
- **RabbitMQ**: `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST` + 다수의 queue/routing key (env.example 참고)
- **Sqids 토큰**: `APP_ID_CODEC_ALPHABET`, `APP_ID_CODEC_MIN_LENGTH` (외부 노출 ID 인코더)

전체 env 키 목록은 `infra/env/app.local.env.example`, `infra/env/infra.local.env.example` 와 `docs/gitlab-variables.md` 참고.

## 5. DB 세팅
운영 환경에서는 **DB/Infra Compose** 와 **App Compose** 를 **분리 운영**한다. (D206 의 운영 방식과 동일)

### 5.0 컴포즈 분리 정책
- 경로
  - DB/Infra: `infra/compose/docker-compose.infra-{local,dev,master}.yml`
  - App: `infra/compose/docker-compose.app-{local,dev,master}.yml`
- 환경별 네트워크 (external)
  - dev: `dev-s210-app-net`, `dev-s210-infra-net`
  - master: `prod-s210-app-net`, `prod-s210-infra-net`
- App 컴포즈는 infra 네트워크를 `external: true` 로 참조

### 5.1 DB 자동 생성
`infra/compose/docker-compose.infra-*.yml` 의 MySQL 컨테이너가 환경변수로 자동 생성한다.

```yaml
environment:
  MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
  MYSQL_DATABASE: iportfolio
  MYSQL_USER: ${MYSQL_USER}
  MYSQL_PASSWORD: ${MYSQL_PASSWORD}
```

수동으로 추가 DB 가 필요한 경우만:
```sql
CREATE DATABASE iportfolio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5.2 스키마 마이그레이션
**Flyway 가 backend 기동 시 자동 실행**한다. `app/backend/src/main/resources/db/migration/V{N}__*.sql` 파일 순서대로 적용.

수동 dump 적재가 필요한 경우 (다른 운영 데이터 이관 등):
```bash
mysql -u <계정> -p iportfolio < exec/dump.sql
```

## 6. 서비스 실행
권장 실행 순서: `Network → Infra Compose → App Compose`

### 6.0 네트워크 생성 (최초 1회)
```bash
# dev
docker network create dev-s210-app-net
docker network create dev-s210-infra-net

# master
docker network create prod-s210-app-net
docker network create prod-s210-infra-net
```

### 6.1 Infra Compose 기동
```bash
# 운영
bash infra/scripts/deploy-infra-master.sh

# 개발
bash infra/scripts/deploy-infra-dev.sh

# 로컬
docker compose -f infra/compose/docker-compose.infra-local.yml up -d
```

`mysql`, `redis`, `rabbitmq` 가 healthy 상태로 올라온 뒤 app 기동.

### 6.2 App Compose 기동
```bash
# CI/CD 통한 자동 배포: dev 브랜치 push → 파이프라인 자동 실행
# 수동 실행
docker compose \
  -f infra/compose/docker-compose.app-master.yml \
  --env-file /tmp/env/app.master.env \
  up -d --build
```

App 컴포즈 서비스:
- `nginx` (frontend + 리버스 프록시) — 80/443
- `backend` (Spring Boot) — 8080 (운영) / 8081 (dev)
- `ai-worker` (CPU consumer, scale 가능)
- `ai-tts-story-worker` (GPU consumer)
- `ai-tts-preview-worker` (GPU consumer)

### 6.3 Qwen TTS 서버 (외부 GPU 머신) 기동
운영/개발 서버와 **분리된 GPU 머신**에서 단일 파일 (`app/ai/qwen_tts_server.py`) 을 FastAPI + uvicorn 으로 직접 띄운다. 일반적인 app/ai 워커와는 다른 별도 프로세스.

#### 6.3.1 요구 사항
- NVIDIA GPU + CUDA (Qwen3-TTS 모델 로딩에 필요 — `Qwen/Qwen3-TTS-12Hz-0.6B-Base`)
- Python 3.11+
- `ffmpeg` 설치 (reference 오디오 → 24 kHz mono WAV 변환에 사용)
- 의존성: `torch`, `soundfile`, `fastapi`, `uvicorn`, `qwen-tts` (Qwen3TTSModel)
- HuggingFace 모델 다운로드 가능한 네트워크 + 충분한 디스크 (모델 weight 수 GB)

#### 6.3.2 설치
```bash
# Ubuntu 기준
sudo apt-get update && sudo apt-get install -y ffmpeg

# Python 가상환경
python3.11 -m venv .venv
source .venv/bin/activate

# 의존성 — 일반 app/ai 워커와 다른 별도 환경 권장 (torch + qwen-tts)
pip install --upgrade pip
pip install torch soundfile fastapi "uvicorn[standard]"
pip install qwen-tts   # HuggingFace Qwen3-TTS 패키지
```

#### 6.3.3 Tailscale 가입 (필수)
이 GPU 머신은 Tailscale 메시 안에서만 노출된다. 인터넷 직접 노출 금지.
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --authkey=tskey-auth-xxxxxxxx
sudo systemctl enable tailscaled

# 확인 — 운영 노드(ai-worker)에서 ping 도달 가능해야 함
tailscale status
```

#### 6.3.4 실행
```bash
# 단일 파일 직접 실행 (앱 디렉토리에서)
uvicorn qwen_tts_server:app --host 0.0.0.0 --port 8091 --workers 1
```

- 포트는 운영 측 `QWEN_TTS_SERVER_URL` 과 일치해야 함 (현재 `8091`)
- `--workers 1` 권장 — Qwen3TTSModel 이 GPU 메모리에 1번만 로드되도록 (멀티 worker 시 OOM 위험)
- 첫 기동 시 HuggingFace 에서 모델 weight 다운로드 → 수십 초~분 소요

#### 6.3.5 헬스체크
```bash
# GPU 머신 로컬에서
curl http://localhost:8091/health
# → {"status":"ok","modelLoaded":true,"cuda":true,...} 형태

# 운영 노드에서 (Tailscale 경유)
curl http://100.64.201.34:8091/health   # 실제 GPU 노드의 Tailscale IP
```

#### 6.3.6 systemd 서비스 등록 (운영 권장)
GPU 머신이 재부팅돼도 자동 기동되도록 systemd unit 작성.
```ini
# /etc/systemd/system/qwen-tts.service
[Unit]
Description=Qwen TTS Server
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/qwen-tts/app/ai
Environment=PATH=/home/ubuntu/qwen-tts/.venv/bin
ExecStart=/home/ubuntu/qwen-tts/.venv/bin/uvicorn qwen_tts_server:app --host 0.0.0.0 --port 8091 --workers 1
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now qwen-tts.service
sudo journalctl -u qwen-tts -f          # 로그 모니터링
```

#### 6.3.7 API 명세
- `GET /health` — 모델/CUDA 상태 조회
- `POST /tts/voice-clone` — multipart/form-data
  - `texts_json` (str, JSON 배열): 합성할 문장 목록
  - `ref_audio` (file): reference WAV/MP3/WebM (ffmpeg 자동 변환)
  - `language` (str): `"Korean"`, `"English"`, ...
  - `ref_text` (str, optional)
  - `x_vector_only_mode` (str: `"true"` / `"false"`)
  - `response_format` (str: `"wav"` 등)
- 응답: `{"audios": [{"index": 0, "audioBase64": "...", "format": "wav"}, ...]}`

### 6.4 로컬 개발 (단축)
```bash
alias dci='docker compose -f infra/compose/docker-compose.infra-local.yml'
alias dca='docker compose -f infra/compose/docker-compose.app-local.yml'

dci up -d       # infra 먼저
dci ps          # mysql healthy 확인
dca up -d --build
```

자세한 내용은 [docs/local-dev.md](../docs/local-dev.md) 참고.

## 7. 포트 및 접근 경로
### 7.1 환경별 포트 레이아웃

| 서비스 | local (호스트) | dev (호스트) | master (호스트) | 내부 |
|---|---|---|---|---|
| nginx (외부 진입) | **3001** | **3001** | **80 / 443** | 80 / 443 |
| backend | 8081 | 8081 | 8080 | 8080 |
| mysql | 3307 | 3307 | 3306 | 3306 |
| redis | 6380 | 6380 | 6379 | 6379 |
| rabbitmq (AMQP) | 5673 | 5673 | 5672 | 5672 |
| rabbitmq (UI) | 15673 | 15673 | 15672 | 15672 |

> AI 워커는 RabbitMQ consumer 라 HTTP 포트를 publish 하지 않는다.

### 7.2 주요 API 경로
- 인증: `POST /api/auth/kakao/callback`, `POST /api/auth/refresh`, `POST /api/auth/logout`
- Email 인증: `POST /api/auth/email/send-code`, `POST /api/auth/email/verify-code`
- 동화 생성: `POST /api/stories`, `GET /api/stories/draft`, `POST /api/stories/{storyId}/...`
- 뷰어: `GET /api/stories/{storyId}/view`, `GET /api/public/stories/sample`, `GET /api/public/stories/share/{shareToken}`
- 잡 상태 polling: `GET /api/jobs/{jobId}`
- 마이페이지/보이스: `GET /api/me`, `POST /api/voice-profiles/*`

## 8. 운영 배포 시 체크 포인트
- Kakao Developers 콘솔의 Redirect URI 에 운영/개발 도메인 모두 등록 — `OAUTH_ALLOWED_REDIRECT_URIS` 와 정확히 일치해야 함
- CORS 허용 Origin (Spring `application-master.yml`) 이 운영 도메인 (`https://talemory.site`) 과 일치
- Let's Encrypt 인증서 `/etc/letsencrypt/live/talemory.site/` 에 위치, nginx 컨테이너에 read-only 마운트
- HSTS 는 초기 600초 — 안정화 후 1년 (`31536000`) 으로 상향 권장
- 비밀키 (`JWT_*_SECRET`, `KAKAO_CLIENT_SECRET`, `AWS_SECRET_ACCESS_KEY`, `OPENAI_API_KEY` 등) 는 **GitLab CI/CD Variables** 로만 관리, repo 에 commit 금지
- 분리 Compose 사용 시 app/infra 가 같은 external network 에 연결되어 있는지 항상 확인
- **Tailscale 메시 활성**: 서버에서 `tailscale status` 정상 + Qwen TTS 노드 (100.64.x.x) 도달 가능 확인. `tailscaled` 가 reboot 후 자동 시작되도록 `systemctl enable tailscaled` 적용

## 9. 배포 파일 관리 기준 (Nginx / Docker / CI)
운영 포팅 시 아래 파일/디렉토리가 필요하다.

### 9.1 필수 파일
- App Compose: `infra/compose/docker-compose.app-master.yml`
- Infra Compose: `infra/compose/docker-compose.infra-master.yml`
- Backend Dockerfile: `app/backend/Dockerfile`
- AI Dockerfile: `app/ai/Dockerfile`
- Qwen TTS 서버 (외부 GPU 머신): `app/ai/qwen_tts_server.py` 단일 파일 + `app/ai/requirements.txt` (uvicorn 직접 실행, Docker 미사용)
- Frontend Dockerfile: `infra/docker/frontend.Dockerfile` (multi-stage: pnpm build → nginx 컨테이너 합성)
- Nginx 설정: `infra/nginx/nginx.{common,local,dev,prod}.conf`
- 배포/검증 스크립트: `infra/scripts/deploy-*.sh`, `health-check-*.sh`
- CI 파이프라인: `.gitlab-ci.yml`, `.gitlab/ci/{app,infra}.gitlab-ci.yml`

### 9.2 Nginx 라우팅 기준 (운영)
- `/` → frontend 정적 파일 (`/usr/share/nginx/html`, `try_files $uri $uri/ /index.html`)
- `/api/` → backend 컨테이너 (`http://prod-backend:8080`)
- 80 → 443 강제 리다이렉트 (`return 301 https://$host$request_uri`)
- ACME challenge: `/.well-known/acme-challenge/` → `/var/www/certbot`

### 9.3 HTTPS 설정
- 인증서: Let's Encrypt (Certbot)
- 발급 명령:
```bash
sudo certbot certonly --webroot -w /var/www/certbot -d talemory.site
```
- 갱신 후 nginx reload:
```bash
docker compose -f infra/compose/docker-compose.app-master.yml exec nginx nginx -s reload
```

### 9.4 OAuth 와 HTTPS 연계 주의사항
- Kakao Developers 의 Redirect URI 를 반드시 `https://` 기준으로 등록
- `OAUTH_ALLOWED_REDIRECT_URIS` 백엔드 환경변수에도 `https://talemory.site/auth/kakao/callback` 포함
- frontend 는 `window.location.origin` 으로 redirect URI 동적 생성 → backend 가 화이트리스트 검증
- HTTP/HTTPS 혼용 시 redirect_uri mismatch 오류 발생

## 10. CI/CD 배포 흐름
GitLab CI (`.gitlab-ci.yml`) — `dev`/`master` 브랜치 push 시 자동.

```
dev/master push
  → generate_env             (GitLab Variables → /tmp/env/*.env)
  → deploy_infra_<env>       (infra 파일 변경 시 자동, 아니면 skip)
  → verify_infra_<env>       (mysql/redis/rabbitmq 접속 + creds 정렬 검증)
  → build (frontend / backend / ai 병렬)
  → deploy_<env>             (compose up -d, 즉시 = dev / manual = master)
  → health-check_<env>       (nginx 경유 /api/health + ai-worker container + RabbitMQ consumer probe)
  → notify_<env>             (Discord 알림)
```

- **이미지 태그** = `$CI_COMMIT_SHORT_SHA` (immutable, 덮어쓰기 없음)
- **Registry 미사용**: SSAFY GitLab 의 Container Registry 가 비활성이라 로컬 빌드 → daemon 그대로 compose 가 씀
- **자동 rollback 없음**: 실패 시 `git revert` 또는 `APP_IMAGE_TAG=<prev_short_sha>` override 재실행으로 복구

자세한 내용은 [docs/ci-cd-pipeline-flow.md](../docs/ci-cd-pipeline-flow.md) 참고.

## 11. 검증 절차
### 11.1 인프라 기동 확인
```bash
docker ps --filter "name=prod-"
# mysql, redis, rabbitmq 모두 Up (healthy)
```

### 11.2 백엔드 기동 확인
```bash
curl https://talemory.site/api/health    # → 200 OK
docker logs prod-backend --tail 50       # Flyway 마이그레이션 + Tomcat 8080 listening 확인
```

### 11.3 프론트 연동 확인
- 브라우저로 `https://talemory.site` 접속 → 메인 화면 렌더링
- 개발자 도구 Network 탭에서 `/api/*` 호출이 200/401 정상 응답

### 11.4 OAuth 확인
- Kakao 로그인 → `/auth/kakao/callback` → JWT 토큰 발급 → 메인 화면 진입

### 11.5 AI 잡 큐 확인
- RabbitMQ 관리 UI (`http://<server>:15672`) 접속
- exchange: `ai.request` / `ai.result` 존재 확인
- queue 별 consumer 수 ≥ 1 확인

## 12. 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| Kakao 로그인 실패 (redirect_uri mismatch) | `OAUTH_ALLOWED_REDIRECT_URIS` 와 Kakao Developers 콘솔 Redirect URI 일치 확인 |
| 401 반복 발생 | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` 적용 여부 + 토큰 만료시간 점검 |
| DB 연결 실패 (`Flyway Communications link failure`) | infra 가 healthy 되기 전 app 기동. `infra` 먼저 → `app` 순서 준수 |
| Redis `NOAUTH` | `application.yml` 의 `${REDIS_PASSWORD}` 와 `infra.*.env` 의 `REDIS_PASSWORD` 일치 확인 |
| RabbitMQ consumer 0 | AI 워커 컨테이너 죽음. `docker logs prod-ai-worker-1` 확인 |
| TTS 잡 timeout | Qwen TTS 서버 응답 안 함. `QWEN_TTS_SERVER_URL` 접근성 + `QWEN_TTS_TIMEOUT_SEC` 점검 |
| Qwen TTS `Connection refused` / `No route to host` | Tailscale 메시 끊김. `tailscale status` 확인 → `sudo tailscale up --authkey=...` 재인증. tailnet 노드 expire 가 가장 흔한 원인 |
| Qwen TTS 서버 기동 시 `ffmpeg is not installed` | GPU 머신에 ffmpeg 누락. `sudo apt-get install -y ffmpeg` |
| Qwen TTS 서버 기동 시 CUDA OOM | `Qwen3-TTS-12Hz-0.6B-Base` 모델이 GPU 메모리 부족. uvicorn `--workers` 를 1 로 강제 + 다른 GPU 사용 프로세스 종료 |
| Qwen TTS 서버 응답 timeout (5분 만료) | sentence batch 가 너무 큰 경우. `MAX_NEW_TOKENS=800` + `CHUNK_SIZE=8` (qwen_tts_server.py) 튜닝 또는 BE 측 `QWEN_TTS_TIMEOUT_SEC` 증대 |
| Qwen TTS 서버 자동 재시작 안 됨 | systemd 등록 누락. § 6.3.6 참고해서 `qwen-tts.service` 등록 + `systemctl enable` |
| nginx `cert not found` | Let's Encrypt 인증서 마운트 누락. `/etc/letsencrypt:/etc/letsencrypt:ro` 확인 |
| CORS 오류 | Spring `application-master.yml` 의 CORS Origin 과 실제 frontend 도메인 일치 확인 |
| Flyway migration 실패 | `Vn__*.sql` 파일 변경 후 재실행 시 checksum mismatch — `flyway_schema_history` 의 해당 row 의 `checksum` 수동 갱신 |
| 이미지 빌드 시 컨텍스트 누락 | `infra/docker/frontend.Dockerfile` 은 repo 루트가 context. compose 의 `context: ../..` 유지 |
