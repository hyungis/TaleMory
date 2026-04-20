# Check Mode — env 정합성 감사

## 목적

코드가 참조하는 env 키와 `*.env.example`에 선언된 키 사이의 불일치를 감지:

- **Missing** — 코드 참조 중이지만 어떤 `.example`에도 선언 안 됨 → CI/배포 시 runtime 에러 위험
- **Orphan** — `.example`에 선언됐지만 어떤 코드에서도 안 쓰임 → 죽은 변수
- **Scope mismatch** — backend에 선언했는데 frontend가 참조 (또는 반대) → 변수 위치가 틀림

## 수집 명령

모두 `$REPO`(=`git rev-parse --show-toplevel`) 기준.

### Backend에서 참조하는 키

```bash
# application*.yml의 ${VAR}
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

### Env example에서 선언된 키

```bash
for f in "$REPO"/infra/env/*.env.example; do
  grep -E '^[A-Z][A-Z0-9_]+=' "$f" | sed 's/=.*//'
done | sort -u > /tmp/env-declared.txt
```

### 선언된 키의 위치 기록 (scope mismatch용)

```bash
for f in "$REPO"/infra/env/*.env.example; do
  name=$(basename "$f" .env.example)
  grep -E '^[A-Z][A-Z0-9_]+=' "$f" | sed "s/=.*/ $name/"
done | sort -u > /tmp/env-declared-with-scope.txt
# 출력: KEY scope 형식 (예: DB_PASSWORD app.dev)
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

`whitelist.md`로 필터링 → 실 orphan 확정 (해당 파일의 "자동 검증" 섹션 참고).

### Scope Mismatch

각 참조 키가 어느 서비스에 속하는지 vs 어느 파일에 선언됐는지 비교:

- backend-ref인 키가 `app.*.env`에 있음 → OK
- backend-ref인 키가 `infra.*.env`에만 있음 → mismatch (infra는 DB 컨테이너 전용)
- frontend-ref인 키가 `VITE_`로 시작하지 않음 → warning

MVP에선 이 3개 패턴만 검사하고 자동 수정은 하지 않는다.

## 리포트 포맷

```
📋 env-sync check 결과

✅ 일치: <N>개 키

❌ Missing (코드 참조, 선언 없음): <N>개
  - <KEY>         <service>가 참조 (<file>:<line>)
  → infra/env/*.env.example 추가 + GitLab Variables 등록 필요

⚠️ Orphan (선언됐으나 미사용): <N>개
  - <KEY>         <.example file>에 선언, 참조 없음
  → 안 쓰면 제거 또는 whitelist.md에 추가

🔍 Scope 불일치: <N>개
  - <KEY>         backend 참조지만 infra.*.env에만 선언
  - <KEY>         frontend 참조지만 VITE_ prefix 아님
```

파일/라인 표시는 실제 grep 결과의 파일 경로를 쓴다:

```bash
grep -rn --include='*.yml' "\${KEY_NAME}" "$REPO/app/backend/src/main/resources"
```

## --fix 플래그

사용자가 "check --fix" 또는 "정합성 검사하고 missing은 고쳐줘" 지시 시:

1. Missing 목록을 사용자에게 먼저 보여준다
2. 각 missing 키마다: 어느 서비스용인지(backend/frontend/ai) 추론해서 추가할 `.example` 제안
   - backend-ref → `app.<env>.env.example`
   - frontend-ref → `app.<env>.env.example` (VITE_ prefix 검증)
   - ai-ref → `app.<env>.env.example`
3. 각 항목 승인 후 add-mode 로직 재사용해서 적용
4. Orphan은 자동 삭제하지 않음 — 사용자 직접 판단

기본은 report-only.

## 실행 순서

1. `$REPO` 확정
2. 위 grep 수집 (병렬 가능 — backend/frontend/ai 독립적)
3. 크로스체크 연산
4. 리포트 출력
5. `--fix` 모드면 항목별 사용자 승인 받고 add-mode 호출
