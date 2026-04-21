# Check Mode — env 정합성 감사

## 목적

코드가 참조하는 env 키와 로컬 `infra/env/*.local.env.example` / `infra/env/README.md`에 선언된 키 사이의 불일치를 감지:

- **Missing** — 코드 참조 중이지만 어떤 선언 소스에도 없음 → runtime 에러 위험
- **Orphan** — 선언은 됐지만 어떤 코드에서도 안 쓰임 → 죽은 변수
- **Scope mismatch** — backend가 참조하는 키가 infra 전용 섹션에만 있음 / frontend 키가 `VITE_` prefix 아님 등

## 수집 명령

모두 `$REPO`(=`git rev-parse --show-toplevel`) 기준.

### Backend에서 참조하는 키

Tracked source of truth는 `application-example.yml` 하나. `application.yml`은 Dockerfile이 build 시점에 `cp -f`로 항상 덮어쓰는 derived artifact. 두 파일 모두 스캔하되 **의미있는 것은 example** — application.yml은 빌드 시 즉시 무시됨.

```bash
# application*.yml의 ${VAR} (example + 작업본 모두)
grep -rEho '\$\{[A-Z][A-Z0-9_]+' "$REPO/app/backend/src/main/resources" 2>/dev/null \
  | sed 's/^\${//' | sort -u > /tmp/env-backend-refs.txt

# Kotlin @Value("${VAR}") 또는 @Value("\${VAR}")
grep -rEho '@Value\("\\?\$\{[A-Z][A-Z0-9_]+' "$REPO/app/backend/src" 2>/dev/null \
  | sed -E 's/.*\$\{//' | sort -u >> /tmp/env-backend-refs.txt

sort -u -o /tmp/env-backend-refs.txt /tmp/env-backend-refs.txt
```

### Frontend (Vite)

```bash
grep -rEho 'import\.meta\.env\.VITE_[A-Z0-9_]+' "$REPO/app/frontend/src" 2>/dev/null \
  | sed 's/^import\.meta\.env\.//' | sort -u > /tmp/env-frontend-refs.txt
```

### AI (Python)

```bash
grep -rEho 'os\.(getenv|environ(\.get|\[))\s*[("]\s*"[A-Z][A-Z0-9_]+"' "$REPO/app/ai" 2>/dev/null \
  | sed -E 's/.*"([A-Z][A-Z0-9_]+)".*/\1/' | sort -u > /tmp/env-ai-refs.txt
```

### 선언된 키 (2개 소스 합집합)

#### 소스 1 — 로컬 `*.local.env.example` (로컬 전용)

```bash
cat "$REPO/infra/env/app.local.env.example" "$REPO/infra/env/infra.local.env.example" \
  | grep -E '^[A-Z][A-Z0-9_]+=' \
  | sed 's/=.*//' | sort -u > /tmp/env-declared-local.txt
```

#### 소스 2 — `infra/env/README.md` 테이블 (GitLab Variables 전용)

```bash
# ENV_<TARGET>_<SVC>_<KEY> 형식을 테이블에서 추출 → prefix 제거 → 최종 키만 남김
grep -oE '`ENV_(BASE|DEV|MASTER)(_(BACKEND|FRONTEND|AI|INFRA))?_[A-Z][A-Z0-9_]+`' "$REPO/infra/env/README.md" \
  | sed -E 's/`//g; s/^ENV_(BASE|DEV|MASTER)(_(BACKEND|FRONTEND|AI|INFRA))?_//' \
  | sort -u > /tmp/env-declared-gitlab.txt
```

#### 합집합

```bash
sort -u /tmp/env-declared-local.txt /tmp/env-declared-gitlab.txt > /tmp/env-declared.txt
```

## 크로스체크

### Missing

```bash
cat /tmp/env-backend-refs.txt /tmp/env-frontend-refs.txt /tmp/env-ai-refs.txt \
  | sort -u > /tmp/env-all-refs.txt

comm -23 /tmp/env-all-refs.txt /tmp/env-declared.txt > /tmp/env-missing.txt
```

### Orphan (화이트리스트 적용 전)

```bash
comm -13 /tmp/env-all-refs.txt /tmp/env-declared.txt > /tmp/env-orphan-candidates.txt
```

`whitelist.md`로 필터링 → 실 orphan 확정. (해당 파일의 "자동 검증" 섹션)

### Scope Mismatch

- backend-ref 키가 `infra/env/README.md`의 `ENV_*_INFRA_*` 섹션에만 있으면 mismatch
- frontend-ref 키가 `VITE_`로 시작하지 않으면 warning
- `infra/env/*.local.env.example`에만 있고 `infra/env/README.md`에 없으면 "CI에서 못 받는 로컬-only 키" 경고 (의도일 수 있으니 info 레벨)
- backend/frontend/ai 참조 키가 `infra/env/infra.local.env.example`에만 선언됐거나 그 반대면 mismatch
- **backend 키가 로컬 `application.yml`에만 있고 `application-example.yml`에 없으면 error** — dev가 example 대신 application.yml을 편집함. Dockerfile `cp -f`로 **다음 빌드에서 즉시 소실됨**. 반드시 example로 옮기라고 안내.

MVP에선 이 3개 패턴만 검사, 자동 수정 없음.

## 리포트 포맷

```
📋 env-sync check 결과

✅ 일치: <N>개 키 (로컬 + GitLab)

❌ Missing (코드 참조, 선언 없음): <N>개
  - <KEY>         <service>가 참조 (<file>:<line>)
  → infra/env/*.local.env.example + infra/env/README.md 추가 + GitLab Variables 등록 필요

⚠️ Orphan (선언됐으나 미사용): <N>개
  - <KEY>         <source>에 선언, 참조 없음
  → 안 쓰면 제거 또는 whitelist.md에 추가

🔍 Scope 불일치: <N>개
  - <KEY>         backend 참조지만 INFRA 섹션에만 선언 (README 3-6)
  - <KEY>         frontend 참조지만 VITE_ prefix 아님
```

파일/라인 표시는 실제 grep 결과의 파일 경로와 라인 번호 사용:

```bash
grep -rn --include='*.yml' "\${KEY_NAME}" "$REPO/app/backend/src/main/resources"
```

## --fix 플래그

사용자가 "check --fix" 또는 "정합성 검사하고 missing은 고쳐줘" 지시 시:

1. Missing 목록을 사용자에게 먼저 보여줌
2. 각 missing 키마다: 어느 서비스용인지(backend/frontend/ai) 추론해서 추가 대상 제안
   - backend-ref → `infra/env/app.local.env.example` + README 3-3
   - frontend-ref → `infra/env/app.local.env.example` + README 3-4 (VITE_ prefix 검증)
   - ai-ref → `infra/env/app.local.env.example` + README 3-5
3. 각 항목 승인 후 add-mode 로직 재사용해서 적용
4. `gitlab-vars` 모드 자동 재실행으로 `docs/gitlab-variables.md` 업데이트
5. Orphan은 자동 삭제하지 않음 — 사용자 직접 판단

기본은 report-only.

## 실행 순서

1. `$REPO` 확정
2. 위 grep 수집 (backend/frontend/ai 독립적 → 병렬 가능)
3. 선언 소스 파싱 (`infra/env/app.local.env.example` + `infra/env/infra.local.env.example` + `infra/env/README.md`)
4. 크로스체크 연산
5. 리포트 출력
6. `--fix` 모드면 항목별 사용자 승인 받고 add-mode + gitlab-vars 순차 호출
