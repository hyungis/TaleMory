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

## 앱 표준 env (프레임워크가 직접 읽지만 코드에는 안 나타나는 경우)

- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` — Spring DataSource 설정에서 간접 참조 가능
- `VITE_API_BASE_URL` — Vite 빌드 시 자동 주입 (코드에서 `import.meta.env.VITE_API_BASE_URL`로 쓰면 grep에 걸림)

→ `DB_*` 3개는 backend `application.yml`이 `${DB_URL}`로 명시 참조해야 정상. 참조 없으면 Spring이 사실상 무시.

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
