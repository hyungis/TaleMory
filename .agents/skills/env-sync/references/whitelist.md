# Whitelist — Orphan 판정 예외

`*.env.example`에 선언됐지만 코드 전역 grep에 걸리지 않는 키들. check 모드가 "orphan"으로 오탐하지 않도록 명시적으로 제외한다.

## Spring Boot 표준 (indirect 주입)

Spring Boot는 env var → property name 자동 변환:
- `SPRING_DATASOURCE_URL` → `spring.datasource.url`
- 코드에선 property name 형식으로만 참조되므로 `SPRING_DATASOURCE_*` 형태 env는 grep 누락

표준 키:

- `SPRING_PROFILES_ACTIVE`
- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `SERVER_PORT`

## Docker 이미지 표준 (컨테이너 자체가 읽는 키)

### MySQL (공식 이미지)

- `MYSQL_ROOT_PASSWORD`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_PORT` (compose publish)

### Redis

- `REDIS_PORT` (compose publish)

### RabbitMQ

- `RABBITMQ_DEFAULT_USER`
- `RABBITMQ_DEFAULT_PASS`
- `RABBITMQ_PORT`
- `RABBITMQ_MANAGEMENT_PORT`

## Compose/CI 표준 (compose yml 또는 runner가 읽음)

- `COMPOSE_PROJECT_NAME`
- `FRONTEND_PORT`
- `BACKEND_PORT`
- `AI_PORT`
- `ENV_DIR`
- `REGISTRY`
- `APP_IMAGE_TAG`
- `AI_WORKER_REPLICAS`

## 앱 표준 env (프레임워크가 직접 읽지만 코드에는 안 나타나는 경우)

- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` — Spring DataSource 설정에서 간접 참조 가능
- `VITE_API_BASE_URL` — Vite 빌드 시 자동 주입 (코드에서 `import.meta.env.VITE_API_BASE_URL`로 쓰면 grep에 걸림)

→ `DB_*` 3개는 backend `application.yml`이 `${DB_URL}`로 명시 참조해야 정상. 참조 없으면 Spring이 사실상 무시.

## Fallback alias (코드에서만 참조되는 하위 폴백 — 선언 불필요)

config.py 등에서 `getenv("X", getenv("Y"))` 패턴의 **두 번째 인자**로만 등장하는 키들. 실제로는 첫 번째 키가 주 이름이고 아래 키들은 "설정 안 했으면 이걸 대신 써"라는 레거시/공유 폴백. 따라서 `infra/env/*.local.env.example` / `infra/env/README.md`에 별도 선언 불필요.

- `GOOGLE_API_KEY` — `GEMINI_API_KEY`의 폴백 (`app/ai/app/core/config.py`)
- `RABBITMQ_USER` — `RABBITMQ_USERNAME`의 폴백 (`app/ai/app/core/config.py`)
- `STORYBOARD_IMAGE_S3_BUCKET` — `AWS_S3_BUCKET`을 재사용 (별도 버킷 분리 시에만 직접 설정)
- `STORYBOARD_IMAGE_S3_REGION` — `AWS_REGION`을 재사용
- `STORYBOARD_IMAGE_S3_ACCESS_KEY_ID` — `AWS_ACCESS_KEY_ID`를 재사용
- `STORYBOARD_IMAGE_S3_SECRET_ACCESS_KEY` — `AWS_SECRET_ACCESS_KEY`를 재사용

## 선택 기능 (코드 참조 O, 기본값 None에서도 정상 동작 — 현재 미사용)

`getenv("X")` 단독 호출이지만 **None일 때 호출부가 조건 분기로 graceful하게 처리**해서 값이 없어도 무관한 키들. 특정 환경/인프라(non-AWS S3, CDN 등) 도입 시에만 활성화.

- `STORYBOARD_IMAGE_S3_ENDPOINT_URL` — MinIO 등 non-AWS S3 endpoint 쓸 때만. 미설정 시 boto3 기본 AWS 사용 (`app/ai/app/services/storyboard_image_service.py`의 `client_kwargs` 조건부 주입).
- `STORYBOARD_IMAGE_PUBLIC_BASE_URL` — CloudFront 등 공개 CDN base URL. 미설정 시 presigned URL 경로로 폴백.

## 확장 규칙

새 orphan이 발견되면:

1. 어떤 컨테이너/라이브러리가 해당 키를 읽는지 확인
2. 맞으면 이 파일의 적절한 카테고리에 추가
3. 아무도 안 쓰면 `.env.example`에서 제거 권장 (true orphan)

## 자동 검증 명령

check 모드가 이 파일을 파싱해서 orphan 후보와 차집합 계산:

```bash
# 이 파일에서 백틱으로 감싼 KEY들 추출
grep -oE '^-\s+`[A-Z][A-Z0-9_]+`' "$REPO/.agents/skills/env-sync/references/whitelist.md" \
  | sed 's/^- *`//; s/`.*//' | sort -u > /tmp/env-whitelist.txt

# 실 orphan = 후보 - 화이트리스트
comm -23 /tmp/env-orphan-candidates.txt /tmp/env-whitelist.txt > /tmp/env-real-orphans.txt
```

## 주의

이 파일은 **프로젝트 진화에 맞춰 업데이트 필요**. 새 이미지 도입(예: Elasticsearch) 시 해당 이미지의 표준 env 추가. `managing-skill-evolution` 컨벤션에 따라 변경 기록은 `docs/skill-history/env-sync.md`에 남긴다.
