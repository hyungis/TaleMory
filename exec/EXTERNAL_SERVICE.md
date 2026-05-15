# EXTERNAL_SERVICE

본 문서는 현재 저장소(`S14P31S210`, TaleMory) 기준 외부 서비스 연동 현황을 정리한다.
기준일: 2026-05-14

## 1) 실사용 중인 외부 서비스

### 1-1. Kakao OAuth 2.0 (로그인)
- 용도: 사용자 소셜 로그인 (TaleMory 의 유일한 로그인 수단)
- 백엔드 엔드포인트
  - `POST /api/auth/kakao/callback` — Kakao 인증코드 교환 + JWT 발급
  - `POST /api/auth/refresh` — refresh token 으로 access 재발급
  - `POST /api/auth/logout` — refresh blacklist 처리
- 필수 설정값
  - `KAKAO_CLIENT_ID` — Kakao REST API key
  - `KAKAO_CLIENT_SECRET`
  - `OAUTH_ALLOWED_REDIRECT_URIS` — 콤마 구분 화이트리스트 (frontend 가 `window.location.origin` 기반으로 동적 생성한 redirect URI 를 검증)
- 콜백 흐름
  - FE 가 Kakao 인증 페이지로 redirect → 인증 성공 → `/auth/kakao/callback?code=...` 으로 복귀
  - FE 가 `{ code, redirectUri }` body 로 BE 호출 → BE 가 화이트리스트 검증 후 Kakao 토큰 교환 + JWT 발급
- 운영 Redirect URI 등록 (Kakao Developers 콘솔)
  - `http://localhost:3001/auth/kakao/callback`
  - `https://talemory.site/auth/kakao/callback`
  - `https://k14s210.p.ssafy.io/auth/kakao/callback`

### 1-2. OpenAI API
- 용도
  - **Storyboard 본문 생성** (Step 4): 입력된 가족/여행/사진 메타데이터로 페이지별 영어 + 한국어 동화 텍스트 생성
  - **Storyboard 요약 생성** (Step 3 synopsis)
  - **Sentence 번역** (영문 → 한국어)
- 호출 위치: `app/ai` AI 워커 (`worker.py`)
- 모델
  - `STORYBOARD_MODEL=gpt-4o-mini` (본문)
  - `WEBTOON_STORYBOARD_MODEL=gpt-4o-mini` (웹툰 모드 대화체)
  - `STORYBOARD_SUMMARY_MODEL=gpt-5-nano` (synopsis)
  - `STORYBOARD_SUMMARY_REASONING_EFFORT=high`
- 비용 추적: 환경변수로 단가 주입 → BE 가 `story_generation_jobs.cost_usd` 누적
  - `STORYBOARD_INPUT_COST_PER_1M`, `STORYBOARD_OUTPUT_COST_PER_1M`
  - `STORYBOARD_SUMMARY_INPUT_COST_PER_1M`, `STORYBOARD_SUMMARY_OUTPUT_COST_PER_1M`
- 필수 설정값
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL` (선택 — proxy/대체 endpoint 시)

### 1-3. Google Gemini API (Vision)
- 용도
  - **Storyboard 이미지 생성** (Step 4 라프 일러스트): `STORYBOARD_IMAGE_MODEL=gemini-2.5-flash-image`
  - **Final Illustration 좌표 추출** (WEBTOON 모드): `FINAL_ILLUSTRATION_LAYOUT_MODEL=gemini-3-flash-preview`
    - 최종 삽화 이미지 + 화자 키 메타로 Gemini Vision 호출 → 캐릭터별 anchor 좌표(`x`, `y`) + bbox 추출
    - 결과는 `scenes.character_anchors` JSON 컬럼에 저장
- 호출 위치: `app/ai/app/services/final_illustration_layout_service.py`, `storyboard_image_service.py`
- 필수 설정값
  - `GEMINI_API_KEY` — 비어있으면 WEBTOON 좌표 추출 실패
  - `STORYBOARD_IMAGE_MODEL`, `WEBTOON_STORYBOARD_IMAGE_MODEL`
  - `FINAL_ILLUSTRATION_LAYOUT_MODEL`
- 자동 재시도: Gemini transient 실패 (5xx, timeout, JSON 파싱) 시 3회 exponential backoff (1s → 2s → 4s)

### 1-4. Replicate API
- 용도: 최종 삽화 생성 (FLUX 모델)
- 모델: `FINAL_ILLUSTRATION_MODEL=black-forest-labs/flux-2-klein-9b`
- 호출 위치: `app/ai` AI 워커
- 필수 설정값
  - `REPLICATE_API_TOKEN`
- 비용/concurrency: `AI_REPLICATE_IMAGE_API_CONCURRENCY=5`

### 1-5. Qwen TTS Server (자체 운영 GPU 서버)
- 용도: Voice clone TTS — 사용자 녹음 reference 로 동화 본문 음성 합성
- 호출 위치: `app/ai/app/services/qwen_server_client.py` → `POST {QWEN_TTS_SERVER_URL}{QWEN_TTS_VOICE_CLONE_PATH}` (multipart/form-data)
- payload: `texts_json` (모든 sentence 일괄) + `ref_audio` (WAV) + `language` + `response_format`
- 필수 설정값
  - `QWEN_TTS_SERVER_URL` (예: `http://100.64.201.34:8091`)
  - `QWEN_TTS_VOICE_CLONE_PATH=/tts/voice-clone`
  - `QWEN_TTS_TIMEOUT_SEC=300` (5분, batch 처리 시간 확보)
  - `QWEN_TTS_X_VECTOR_ONLY_MODE=true`
- TTS 저장 모드
  - `TTS_STORAGE_MODE=local` (로컬 nginx 정적 서빙) 또는 `s3`
  - `TTS_PUBLIC_BASE_URL=/static` (local 모드 시 nginx 라우트)
- 기본 언어: `TTS_DEFAULT_LANGUAGE=ko-KR`

### 1-6. CosyVoice (legacy, 선택 사용)
- 용도: 과거 TTS 백엔드 (현재 Qwen 으로 대체). `TTS_ENGINE=cosyvoice` 시 활성
- 호출 경로
  - `COSYVOICE_INSTRUCT_PATH=/inference_instruct2`
  - `COSYVOICE_CROSS_LINGUAL_PATH=/inference_cross_lingual`
  - `COSYVOICE_ZERO_SHOT_PATH=/inference_zero_shot`
- 필수 설정값
  - `COSYVOICE_BASE_URL`
  - `COSYVOICE_TIMEOUT_SEC=60`

### 1-7. AWS S3
- 용도
  - 사용자 업로드 사진 (대표사진 + 가족 멤버 사진)
  - AI 가 생성한 storyboard 이미지 / 최종 삽화 / 일러스트 버전 히스토리
  - 강조 음성 녹음 + 마무리 멘트 녹음
  - Voice clone reference audio
  - 동화별 TTS 결과 audio (TTS_STORAGE_MODE=s3 시)
- 버킷: `s210-iportfolio-dev`
- 키 prefix 정책: `{AWS_S3_ENV_PREFIX}/{AWS_S3_PREFIX}/...`
  - `AWS_S3_ENV_PREFIX=local|dev|prod` — 환경 분리
  - `AWS_S3_PREFIX=stories/tts` (워커 기본값, 다른 도메인은 BE 에서 별도 prefix)
- presigned URL 발급: BE 가 PUT 용 URL 발급 → FE 가 직접 S3 업로드 → s3Key commit API 호출 (3-phase 패턴)
- 필수 설정값
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION=ap-northeast-2`
  - `AWS_S3_BUCKET=s210-iportfolio-dev`
  - `AWS_S3_PUBLIC_BASE_URL` (선택 — CloudFront/CDN 사용 시)

### 1-8. RabbitMQ (자체 운영)
- 용도: BE ↔ AI 워커 비동기 메시징 (topic exchange + fan-out)
- 이미지: `rabbitmq:3-management-alpine`
- Exchange / Routing 구조
  - Request exchange: `ai.request`
  - Result exchange: `ai.result`
  - 주요 routing key (`{도메인}.{액션}` 형식)
    - `ai.cpu.story.generate` / `ai.cpu.story.regenerate` (storyboard 본문)
    - `ai.cpu.story.sentences.translate` (sentence 번역)
    - `ai.image.generate` / `ai.image.generate.item` / `ai.image.regenerate` (라프 일러스트)
    - `ai.image.final-illustration.generate` / `.revise` (최종 삽화)
    - `ai.image.final-illustration.layout` / `.layout.item` (WEBTOON 좌표 추출)
    - `ai.gpu.tts.generate` / `ai.gpu.tts.preview` (TTS)
  - 결과 routing key: `ai.result.{도메인}.{액션}.{completed|failed}`
- Consumer / prefetch
  - `RABBITMQ_PREFETCH_COUNT=20`
  - 잡 타입별 동시성: `AI_WORKER_CONCURRENCY=2`, `AI_IMAGE_API_CONCURRENCY=20`, `AI_GEMINI_IMAGE_API_CONCURRENCY=20`, `AI_LAYOUT_API_CONCURRENCY=20`, `AI_REPLICATE_IMAGE_API_CONCURRENCY=5`
- 필수 설정값
  - `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST`
  - 위 exchange / queue / routing key 약 30여 개 (전체 목록은 `infra/env/app.local.env.example` 참고)

### 1-9. MySQL
- 용도: 메인 RDB. 모든 도메인 데이터 (user, story, storyboard, scene, sentence, voice, job 등)
- 이미지: `mysql:8.4`
- DB 명: `iportfolio`
- 스키마 관리: **Flyway 자동 마이그레이션** — backend 기동 시 `db/migration/V{N}__*.sql` 순차 실행
- 필수 설정값
  - `DB_URL=jdbc:mysql://mysql:3306/iportfolio?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`
  - `DB_USERNAME`, `DB_PASSWORD`
  - `MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` (compose 측)
  - `DDL_AUTO` (Hibernate, default `none` — Flyway 가 schema 관리)

### 1-10. Redis
- 용도
  - 잡 polling 응답 캐시 (TTL 기반, 잡 상태 변경 시 invalidate)
  - Illustration 버전 히스토리 (sceneId 별 LIST + 현재 version pointer)
  - Email 인증 코드 (TTL 5분)
  - Email verified flag (TTL 30분)
- 이미지: `redis:7-alpine`
- 필수 설정값
  - `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
  - `REDIS_DATABASE` (선택, default 0)

### 1-11. JWT
- 용도: BE 인증 토큰 발급/검증 (access + refresh 분리)
- 알고리즘: HS256 (HMAC SHA-256)
- 필수 설정값
  - `JWT_ACCESS_SECRET` (32자 이상 권장)
  - `JWT_REFRESH_SECRET` (별도 비밀키)
- 만료시간 (`application.yml` 기본값)
  - access: ~100시간 (개발 편의 — 운영은 짧게 권장)
  - refresh: 7일
- refresh blacklist: Redis 기반 logout 처리

### 1-12. Tailscale (메시 VPN)
- 용도: 운영/개발 서버 ↔ **외부 GPU 서버**(Qwen TTS) 간 보안 메시 네트워크
  - Qwen TTS 서버를 인터넷에 직접 노출하지 않고 Tailscale 네트워크 내부에서만 접근
  - `QWEN_TTS_SERVER_URL=http://100.64.201.34:8091` 의 `100.64.x.x` IP 는 Tailscale CGNAT 대역 (100.64.0.0/10)
- 적용 위치
  - `ai-tts-story-worker`, `ai-tts-preview-worker` 컨테이너에서 Qwen TTS 호출
  - 동일 Tailscale 네트워크에 연결된 노드만 해당 IP 로 접근 가능
- 운영 준비
  - 서버에 Tailscale 클라이언트 설치 → 로그인 → 운영 tailnet 가입
  - GPU 서버도 같은 tailnet 에 있어야 함
  - ACL 로 `ai-worker` 노드만 Qwen TTS 서버 8091 접근 허용 권장
- 설치 (Ubuntu 기준)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --authkey=tskey-auth-xxxxxxxx  # 운영팀의 auth key 사용
tailscale status                                  # 같은 tailnet 노드 IP 확인
ping 100.64.201.34                                # Qwen TTS 서버 접근 확인
```
- 컨테이너에서 Tailscale IP 접근
  - 호스트의 Tailscale 인터페이스를 통해 outbound 가능 → docker compose 기본 bridge 네트워크에서도 100.64.x.x 호출 OK
  - 별도 sidecar 컨테이너로 Tailscale 을 docker 안에서 띄우는 패턴도 가능하나, 현재는 호스트 Tailscale 사용
- 운영 시 주의
  - `tskey-auth-*` 키는 만료/회전 정책 적용 (90일 기본)
  - 서버 재부팅 후 `tailscaled` 자동 시작 확인 (`systemctl enable tailscaled`)
  - tailnet 에서 노드 expire 되면 Qwen TTS 호출이 모두 connection refused → 즉시 재인증

### 1-13. Gmail SMTP (이메일 인증)
- 용도: 회원가입 / 비밀번호 재설정 시 이메일 인증 코드 전송 (현재 사용 안 함 — Kakao OAuth 만 활성. 코드는 유지)
- 필수 설정값
  - `MAIL_HOST=smtp.gmail.com`
  - `MAIL_PORT=587`
  - `MAIL_USERNAME`, `MAIL_PASSWORD` (Gmail App Password)
  - `MAIL_FROM`, `MAIL_FROM_NAME`
  - `EMAIL_VERIFICATION_CODE_TTL_SECONDS=300`
  - `EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS=1800`

## 2) Frontend 외부 라이브러리 / SDK
- React 19 + Vite 7 + TypeScript 5
- **Three.js** — 메인 화면의 3D 숲 씬 (집/책장 입구)
- **@tanstack/react-query 5** — BE 호출 캐시
- **Tailwind CSS 4** — 스타일
- **Zod** — 폼/응답 스키마 검증
- 필수 환경변수
  - `VITE_API_BASE_URL=/api`
  - `VITE_KAKAO_CLIENT_ID`

## 3) CI/CD 인프라
- **GitLab CI** (`.gitlab-ci.yml`) — SSAFY GitLab project runner (shell executor)
- **Container Registry 미사용** — 서버 docker daemon 안에서 빌드 → 그대로 compose 가 씀
- **Discord Webhook** — 배포 결과 알림 (`infra/scripts/notify.sh`)
- 필수 설정값 (GitLab CI/CD Variables)
  - 모든 env 키는 GitLab Variables 로 주입 → `generate-env.sh` 가 `/tmp/env/*.env` 생성

자세한 변수 매핑은 [docs/gitlab-variables.md](../docs/gitlab-variables.md) 참고.

## 4) 운영 환경 체크리스트

### Kakao Developers Console
- [ ] 앱 생성 + REST API key 발급
- [ ] OAuth 동의항목: `profile_nickname`, `account_email` (필수), 추가 항목은 선택
- [ ] Redirect URI 에 운영/개발/로컬 콜백 모두 등록
- [ ] `OAUTH_ALLOWED_REDIRECT_URIS` 값과 1:1 일치

### Google Cloud Console (Gemini)
- [ ] Gemini API 활성화
- [ ] API key 발급 → `GEMINI_API_KEY`
- [ ] 결제 계정 연결 (free tier 초과 사용 대비)

### OpenAI Platform
- [ ] API key 발급 → `OPENAI_API_KEY`
- [ ] usage limit 설정 (예상 사용량 + 10% 버퍼)

### Replicate
- [ ] account API token 발급 → `REPLICATE_API_TOKEN`
- [ ] FLUX 모델 접근 권한 확인

### AWS
- [ ] S3 버킷 생성 (`s210-iportfolio-dev` 또는 신규)
- [ ] IAM 사용자 생성 + S3 PutObject/GetObject/DeleteObject 권한
- [ ] CORS 정책: BE 도메인 + 로컬 도메인 허용 (PUT 메서드 포함)
- [ ] presigned URL 만료시간: 600초 (기본)

### Qwen TTS Server
- [ ] GPU 서버 구축 + Qwen2-Audio 모델 로드
- [ ] HTTP endpoint 노출 (`/tts/voice-clone`)
- [ ] 최대 body size 설정 (sentence batch + reference WAV ≈ 수 MB 까지)
- [ ] 운영 timeout 정책 (5분 ~ 30분)
- [ ] Tailscale 메시에 GPU 서버 가입 + 인터넷 직접 노출 차단

### Tailscale (메시 VPN)
- [ ] 운영팀 tailnet 생성 + admin 계정 발급
- [ ] auth key (`tskey-auth-*`) 발급 (90일 만료, 회전 정책 적용)
- [ ] 운영/개발 서버 + Qwen TTS GPU 서버 모두 tailnet 가입 확인
- [ ] ACL 로 `ai-worker` 노드만 Qwen TTS 서버 8091 포트 접근 허용
- [ ] 서버 재부팅 후 `tailscaled` 자동 시작 (`systemctl enable tailscaled`)
- [ ] 호스트에서 `ping 100.64.201.34` (또는 실제 Qwen 노드 IP) 도달 확인

### Let's Encrypt (HTTPS)
- [ ] `talemory.site` 도메인 등록
- [ ] DNS A 레코드 → 운영 서버 IP
- [ ] Certbot 발급:
```bash
sudo certbot certonly --webroot -w /var/www/certbot -d talemory.site
```
- [ ] auto-renewal cron 설정 (Certbot 기본 systemd timer)

### 백엔드 / 프론트엔드 환경변수 (최소 필수)
- BE: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `OAUTH_ALLOWED_REDIRECT_URIS`, `AWS_*`
- FE: `VITE_API_BASE_URL`, `VITE_KAKAO_CLIENT_ID`
- AI: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `REPLICATE_API_TOKEN`, `QWEN_TTS_SERVER_URL`, `RABBITMQ_*`, `AWS_*`

## 5) 참고
- 서비스별 키/시크릿은 문서에 값 자체를 기록하지 않고, GitLab CI/CD Variables 로만 관리한다.
- 신규 env 추가 시 `/env-sync add <KEY> <service>` 스킬로 example + README + gitlab-variables.md 동시 갱신.
