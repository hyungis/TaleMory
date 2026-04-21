---
name: env-sync
description: Use when adding, removing, or auditing environment variables across the S210 stack (frontend, backend, ai, infra). Three modes — `add` propagates a new key to the right places, `check` audits code ↔ declared key drift, `gitlab-vars` regenerates the GitLab CI/CD Variables registration checklist. Triggers on "환경변수 추가/삭제/확인/검사", "env-sync", "env var 정합성", "GitLab Variables 체크리스트 갱신", or when editing files under `infra/env/`.
---

# env-sync

S210 프로젝트는 환경변수가 4개 축(frontend, backend, ai, infra)에 흩어져 있어 수동 관리 시 누락/불일치가 쉽게 발생한다. 이 스킬은 추가, 감사, GitLab Variables 체크리스트 생성 세 방향을 자동화한다.

## 컨텍스트 — 로컬 vs CI 구조

로컬과 CI는 env 소스가 완전히 다르다.

- **로컬 개발**: 두 compose 파일(`docker-compose.infra-local.yml` + `docker-compose.app-local.yml`)을 2단계로 기동 — 둘 다 `name: s210-local`로 같은 프로젝트/네트워크 공유. env는 `infra/env/app.local.env` + `infra/env/infra.local.env` (`*.example`에서 복사 후 편집). **루트 `.env`는 사용하지 않음**.
- **CI/운영**: GitLab CI/CD Variables → `infra/scripts/generate-env.sh` → `/tmp/env/app.<target>.env` + `/tmp/env/infra.<target>.env` → `infra/compose/docker-compose.{app,infra}-<target>.yml`

env-sync가 유지해야 할 4개 소스:

| 파일 | 역할 |
|---|---|
| `infra/env/app.local.env.example` | 로컬 개발 템플릿 (backend/frontend/ai) |
| `infra/env/infra.local.env.example` | 로컬 개발 템플릿 (mysql/redis/rabbitmq) |
| `infra/env/README.md` | GitLab Variables 카탈로그 (문서) |
| `docs/gitlab-variables.md` | GitLab Variables 등록 체크리스트 (자동 생성) |
| 서비스 코드 (`application.yml`, React `src/`, Python `app/`) | 실제 참조 위치 |

## 모드

| 모드 | 용도 | 결과물 |
|---|---|---|
| **add** | 신규 키 전파 | `infra/env/*.local.env.example` + README + `gitlab-variables.md` 업데이트, 코드 수정 힌트 |
| **check** | 정합성 감사 | missing / orphan / scope mismatch 리포트 (read-only 기본) |
| **gitlab-vars** | 등록 체크리스트 갱신 | `docs/gitlab-variables.md` 자동 생성 |

사용자 발화에서 모드 추론:

| 키워드 | 모드 |
|---|---|
| "추가", "add", "넣어줘", "생성" (새 변수) | **add** |
| "검사", "확인", "audit", "정합성" | **check** |
| "gitlab", "등록", "체크리스트", "variables 정리" | **gitlab-vars** |

모호하면 한 번 되묻는다.

## CWD 독립성 — 필수

모든 경로는 `git rev-parse --show-toplevel`로 repo 루트를 먼저 해결한 뒤 거기서부터 계산. 상대경로(`./infra/env/...`) 금지.

```bash
REPO="$(git rev-parse --show-toplevel)"
```

이 스킬은 repo 내 어느 디렉토리(`app/backend`, `app/frontend`, `app/ai`, 루트)에서 호출돼도 동일하게 동작해야 한다.

## 원칙

- **서비스 코드를 자동 편집하지 않는다.** `application.yml`, React `src/`, Python `app/` 등은 팀원 책임 영역. 수정 위치 힌트만 출력.
- **secret 성격** 변수(`PASSWORD`, `TOKEN`, `KEY`, `SECRET`, `WEBHOOK`, `DSN` 중 하나 포함)는 GitLab Variables 등록 시 **Masked 권장**.
- **`master` 환경 + Masked** → **Protected 권장**.
- check 모드는 기본 read-only. 자동 수정은 `--fix` 명시 시에만 승인 후 적용.
- `gitlab-vars` 모드는 `docs/gitlab-variables.md`를 **재생성**하되, 기존 체크박스(`- [x]`) 상태는 가능한 한 보존한다.

## 워크플로우

1. 사용자 요청에서 모드(add/check/gitlab-vars) 판단. 모호하면 되묻기.
2. `REPO` 확정.
3. 모드별 상세 절차를 reference 파일에서 로드:
   - add → `references/add-mode.md`
   - check → `references/check-mode.md`
   - gitlab-vars → `references/gitlab-vars-mode.md`
4. 서비스 ↔ 파일 ↔ prefix 매핑은 `references/service-mapping.md`.
5. check / gitlab-vars에서 "orphan" 판정 전 `references/whitelist.md`로 예외 확인.
6. 완료 후 사용자가 다음 해야 할 일(GitLab Variables 실제 등록, 서비스 코드 PR)을 명확히 안내.

## How To Use References

각 reference는 해당 상황에만 로드 (토큰 절약):

- 신규 변수 추가 전 → `references/add-mode.md`
- 정합성 감사 전 → `references/check-mode.md`
- GitLab 체크리스트 재생성 전 → `references/gitlab-vars-mode.md`
- 서비스 매핑/스캔 패턴 확인 시 → `references/service-mapping.md`
- orphan 판정 직전 → `references/whitelist.md`

SKILL.md 자체는 절차를 직접 실행하지 않는다 — 개요와 분기만 담당.
