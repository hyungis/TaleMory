---
name: env-sync
description: Use when adding, removing, or auditing environment variables across the S210 stack (frontend, backend, ai, infra). Triggers on "환경변수 추가/삭제/확인/검사", "env-sync", "env var 정합성", or when editing files under `infra/env/`. Automates propagation to correct env example files + README + GitLab Variables checklist, and cross-checks code references against declared keys.
---

# env-sync

S210 프로젝트는 환경변수가 4개 축(frontend, backend, ai, infra)에 흩어져 있어 수동 관리 시 누락/불일치가 쉽게 발생한다. 이 스킬은 추가와 감사 양방향을 자동화한다.

## 모드

두 모드 중 하나로 동작:

- **add** — 신규 키를 올바른 위치에 전파 (env 예시 + README + GitLab Variables 체크리스트 + 서비스 코드 수정 힌트)
- **check** — 코드와 `*.env.example` 간 정합성 감사 (missing / orphan / scope mismatch 리포트)

사용자 발화에서 모드 추론:

| 키워드 | 모드 |
|---|---|
| "추가", "add", "넣어줘", "생성" | **add** |
| "검사", "확인", "audit", "정합성", "check" | **check** |

모호하면 한 번 되묻는다.

## CWD 독립성 — 필수

모든 경로는 `git rev-parse --show-toplevel`로 repo 루트를 먼저 해결한 뒤 거기서부터 계산한다. 상대경로(`./infra/env/...`) 금지.

```bash
REPO="$(git rev-parse --show-toplevel)"
```

이 스킬은 repo 내 어느 디렉토리(`app/backend`, `app/frontend`, `app/ai`, 루트)에서 호출돼도 동일하게 동작해야 한다.

## 원칙

- **서비스 코드를 자동 편집하지 않는다.** `application.yml`, React `src/`, Python `app/` 등은 팀원 책임 영역. 수정 위치 힌트만 출력.
- secret 성격(`password`, `token`, `key`, `secret` 포함) 변수는 GitLab Variables 등록 시 **Masked 권장**.
- `master` 환경 변수는 **Protected 권장**.
- check 모드는 기본 read-only. 자동 수정은 `--fix` 명시 시에만 승인 후 적용.

## 워크플로우

1. 사용자 요청에서 모드(add/check) 판단. 모호하면 되묻기.
2. `REPO` 확정.
3. 모드별 상세 절차를 reference 파일에서 로드:
   - add → `references/add-mode.md`
   - check → `references/check-mode.md`
4. 서비스 ↔ 파일 ↔ prefix 매핑은 `references/service-mapping.md`.
5. check 모드에서 "orphan" 판정 전 `references/whitelist.md`로 예외 확인.
6. 완료 후 사용자가 다음 해야 할 일(GitLab Variables 등록, 서비스 코드 PR)을 명확히 안내.

## How To Use References

각 reference는 해당 상황에만 로드 (토큰 절약):

- 신규 변수 추가 전 → `references/add-mode.md`
- 정합성 감사 전 → `references/check-mode.md`
- 서비스 매핑/스캔 패턴 확인 시 → `references/service-mapping.md`
- orphan 판정 직전 → `references/whitelist.md`

SKILL.md 자체는 절차를 직접 실행하지 않는다 — 개요와 분기만 담당.
