# Add Mode — 신규 env 변수 전파

## 입력 수집

사용자에게 다음 3가지를 확인한다. 누락 시 되묻는다.

1. **변수 키** — SCREAMING_SNAKE_CASE (예: `OPENAI_MODEL`)
2. **대상 서비스** — `backend`, `frontend`, `ai`, `infra` 중 하나 이상 (콤마 구분)
3. **대상 환경** — `dev`, `master`, `both` (기본값: `both`)

frontend 대상인데 키가 `VITE_` prefix가 아니면 경고 + rename 제안. Vite 빌드에 주입되지 않기 때문.

## 절차

모든 경로는 `$REPO`(=`git rev-parse --show-toplevel`) 기준.

### 1. 로컬 env example 파일 업데이트 (로컬 개발용)

대상 서비스에 따라 파일이 다르다:

| 서비스 | 대상 파일 |
|---|---|
| backend / frontend / ai | `infra/env/app.local.env.example` |
| infra (mysql/redis/rabbitmq) | `infra/env/infra.local.env.example` |

해당 파일에 키 추가. 기본값은 로컬 개발에서 쓰일 만한 실용값:

```dotenv
# <카테고리 주석>
<KEY>=<로컬 기본값>
```

placeholder 선정 기준:
- secret 계열(password/username/token/key/secret): 더미값(`changeme`, `sk-dummy-local` 등). `*.local.env.example`은 gitignored가 아니지만 **로컬 컨테이너 전용의 중요도 낮은 더미값**만 허용. 진짜 secret은 `infra/env/*.local.env`(gitignored)에만.
- 숫자: 합리적 기본값 (`8080`, `30`)
- 문자열: 실 사용 예시 (`local`, `/api`)

**중요 — backend `application-example.yml`의 default 규칙**:
- **secret 성격 키** (`*_PASSWORD`, `*_USERNAME`, `*_TOKEN`, `*_KEY`, `*_SECRET`): `${KEY}` 로만. 기본값 **금지** — tracked 파일에 더미라도 박히면 실수로 확장될 위험.
- **non-secret** (host/port/URL/path): IDE 편의용 default 유지.
- env 미주입 시 Spring이 `PlaceholderResolutionException`으로 **명시적 실패**하게 하는 게 silent wrong value보다 안전.

compose 파일(`infra/compose/docker-compose.{app,infra}-local.yml`)도 필요 시 `${KEY}` 참조 추가:
- infra 서비스의 `environment:` 블록에 compose-parse-time 치환이 필요하면 해당 서비스에 추가
- 단순히 컨테이너 runtime env로만 필요하면 `env_file`로 자동 주입되므로 compose 수정 불필요

### 2. `infra/env/README.md`의 해당 섹션 테이블 업데이트

섹션 위치:
- backend/frontend/ai → `3-3`, `3-4`, `3-5` 섹션 (ENV_DEV_\*)
- infra → `3-6` 섹션
- master 환경은 `3-7` 섹션에서 "dev값과 master값이 다를 경우"만 명시

테이블 행 형식:

```markdown
| `ENV_<TARGET>_<SVC>_<KEY>` | ✅ (secret이면) | 간단 설명 |
```

### 3. `docs/gitlab-variables.md` 재생성

`gitlab-vars` 모드 로직으로 바로 재생성. 체크박스 상태는 보존. 상세는 `gitlab-vars-mode.md`.

### 4. 서비스 코드 수정 힌트 (편집 금지)

서비스별 수정 위치만 안내:

**backend**
- `app/backend/src/main/resources/application-example.yml` **하나만** 수정 (유일한 tracked source of truth).
- secret 키면 **기본값 없이** `${KEY}`로만:
  ```yaml
  spring:
    data:
      redis:
        password: ${REDIS_PASSWORD}     # ← secret: 기본값 금지
  ```
- non-secret이면 IDE 편의용 default 유지 (localhost + compose 호스트 포트):
  ```yaml
  spring:
    data:
      redis:
        port: ${REDIS_PORT:6380}        # ← non-secret: IDE용 default OK
  ```
- `application.yml`은 Dockerfile이 build 시점에 **`cp -f` 로 항상 example에서 덮어쓰기** → 순수 derived artifact. 로컬에 커스텀 있어도 빌드 시 무시됨. 드리프트 원천 불가능.
- compose 안에서는 env_file이 override하므로 default 무관.
- 또는 Kotlin `@Value("\${<KEY>}")` — secret이면 `${KEY}` only, default 없이.

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
- `infra/compose/docker-compose.{infra,app}-*.yml`에서 해당 컨테이너에 필요 시 추가 (보통 `env_file` 자동 주입으로 끝)
- compose image가 자동으로 인식하는 표준 키(`MYSQL_*`, `RABBITMQ_DEFAULT_*` 등)는 `env_file`만으로 충분

### 5. GitLab Variables 등록 체크리스트 콘솔 출력

사용자 화면에 다음 형식으로 출력 (파일 갱신과 별개로):

```
### GitLab → Settings → CI/CD → Variables 등록 필요

대상 환경: <dev | master | both>
키:
  ENV_<TARGET>_<SERVICE>_<KEY>   Type=Variable  Masked=?  Protected=?
```

권장:
- secret 키(password/token/key/secret/webhook/dsn 포함) → **Masked ✅**
- `master` 환경 + Masked → **Protected ✅**

### 6. 변경 요약

마지막 출력:

```
✅ 수정된 파일:
  - infra/env/app.local.env.example (+1 line)      # 또는 infra.local.env.example
  - infra/env/README.md (+1 row in section 3-X)
  - docs/gitlab-variables.md (regenerated)

다음 단계:
  1. GitLab Variables에 위 체크리스트대로 등록
  2. backend 담당자에게 application.yml 수정 요청 (`${OPENAI_MODEL}` 참조 추가)
  3. 로컬 개발자는 `infra/env/app.local.env`에 새 키 수동 추가 (example은 템플릿일 뿐)
  4. PR 후 MR merge → dev pipeline 자동 실행 확인
```

## 예시 실행

사용자: "OPENAI_MODEL을 app에 추가해줘 (기본값 gpt-4o-mini)"

1. 서비스=`app`, 환경=`both`(기본) 확인
2. `infra/env/app.local.env.example`에 `OPENAI_MODEL=gpt-4o-mini` 추가
3. `infra/env/README.md` 3-3 섹션(`ENV_DEV_APP_*`)에 행 추가. master 값이 dev와 같으면 3-5에 별도 표기 불필요.
4. `docs/gitlab-variables.md` 재생성 (체크박스 보존)
5. app 힌트 출력
6. GitLab 체크리스트:
   - `ENV_DEV_APP_OPENAI_MODEL`
   - `ENV_MASTER_APP_OPENAI_MODEL` (Protected)
7. 요약
