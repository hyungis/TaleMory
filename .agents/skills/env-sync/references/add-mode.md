# Add Mode — 신규 env 변수 전파

## 입력 수집

사용자에게 다음 3가지를 확인한다. 누락 시 되묻는다.

1. **변수 키** — SCREAMING_SNAKE_CASE (예: `OPENAI_MODEL`)
2. **대상 서비스** — `backend`, `frontend`, `ai`, `infra` 중 하나 이상 (콤마 구분)
3. **대상 환경** — `dev`, `master`, `both` (기본값: `both`)

frontend 대상인데 키가 `VITE_` prefix가 아니면 경고 + rename 제안. Vite 빌드에 주입되지 않기 때문.

## 절차

모든 경로는 `$REPO`(=`git rev-parse --show-toplevel`) 기준.

### 1. env 예시 파일 업데이트

서비스 ↔ 파일 매핑은 `service-mapping.md`. 간단 요약:

| 서비스 | 파일 |
|---|---|
| backend / frontend / ai | `infra/env/app.<env>.env.example` |
| infra | `infra/env/infra.<env>.env.example` |

대상 환경별로 해당 `.env.example` 파일에 카테고리 주석과 함께 키 추가:

```dotenv
# OpenAI
OPENAI_MODEL=gpt-4o-mini
```

placeholder 선정 기준:
- secret(password/token/key 포함) → `<secret>`
- 숫자 → 합리적 기본값 (`8080`, `30`)
- 문자열 → 실 사용 예시 (`dev`, `/api`, 모델명 등)

`dev`만 또는 `master`만 요청 시 다른 쪽은 건드리지 않는다.

### 2. `infra/env/README.md` 업데이트

"필수 변수 (최소)" 섹션의 해당 서비스 소절에 한 줄 추가:

```markdown
### `ENV_<TARGET>_BACKEND_*`
- ... (기존 항목 유지)
- `<KEY>`   ← 새로 추가
```

섹션이 없으면 적절한 위치에 새로 만든다.

### 3. 서비스 코드 수정 힌트 (편집 금지)

서비스별 수정 위치만 안내:

**backend**
- `app/backend/src/main/resources/application.yml`의 적절한 섹션에 `${<KEY>}` 참조
  ```yaml
  spring:
    datasource:
      url: ${DB_URL}
  ```
- 또는 Kotlin `@Value("\${<KEY>}")`

**frontend**
- Vite는 `VITE_` prefix만 빌드 주입. 키가 `VITE_`로 시작하지 않으면 rename 후:
  ```ts
  const model = import.meta.env.VITE_OPENAI_MODEL;
  ```

**ai**
- Python
  ```python
  import os
  model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
  ```

**infra**
- compose `env_file:`로 자동 주입되므로 대부분 추가 작업 불필요
- 포트/볼륨/네트워크 관련이면 compose yml에 `${<KEY>}` 참조 필요할 수 있음

### 4. GitLab Variables 체크리스트 출력

다음 형식으로 출력:

```
### GitLab → Settings → CI/CD → Variables 등록 필요

대상 환경: <dev | master | both>
키:
  ENV_<TARGET>_<SERVICE>_<KEY>   Type=Variable  Masked=?  Protected=?
```

권장 체크박스:
- secret 성격(password/token/key/secret 포함) → **Masked ✅**
- `master` 환경 → **Protected ✅**

### 5. 변경 요약

마지막 출력:

```
✅ 수정된 파일:
  - infra/env/app.dev.env.example (+1 line)
  - infra/env/app.master.env.example (+1 line)
  - infra/env/README.md (+1 line)

다음 단계:
  1. GitLab Variables에 위 체크리스트대로 등록
  2. backend 담당자에게 application.yml 수정 요청 (`${OPENAI_MODEL}` 참조 추가)
  3. PR 후 MR merge → dev pipeline 자동 실행 확인
```

## 예시 실행

사용자: "OPENAI_MODEL을 backend에 추가해줘 (기본값 gpt-4o-mini)"

1. 서비스=`backend`, 환경=`both`(기본) 확인
2. `app.dev.env.example`, `app.master.env.example` 둘 다에 `OPENAI_MODEL=gpt-4o-mini` 추가
3. `infra/env/README.md`의 `ENV_DEV_BACKEND_*`, `ENV_MASTER_BACKEND_*` 항목에 `OPENAI_MODEL` 한 줄씩 추가
4. backend 힌트 출력
5. GitLab 체크리스트:
   - `ENV_DEV_BACKEND_OPENAI_MODEL`
   - `ENV_MASTER_BACKEND_OPENAI_MODEL` (Protected)
6. 요약
