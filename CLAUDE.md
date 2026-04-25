# S14P31S210 Project Instructions

## Project Skills

This project defines custom skills under `.agents/skills/`. These are **mandatory** — read the relevant skill file before starting any matching work. Do not skip this step even for small changes.

### Skill Trigger Rules

| Skill | Path | When to Read |
|-------|------|--------------|
| `frontend-storybook-architecture` | `.agents/skills/frontend-storybook-architecture/SKILL.md` | Any frontend code addition, review, refactor, or structural decision (feature boundaries, shared placement, page responsibility, public API exports, state ownership, React Query naming) |
| `structuring-kotlin-ddd-code` | `.agents/skills/structuring-kotlin-ddd-code/SKILL.md` | Any Kotlin/Spring Boot backend code review, design, or refactor involving package boundaries, DDD alignment, service responsibilities, or controller thinness |
| `env-sync` | `.agents/skills/env-sync/SKILL.md` | Adding, removing, or auditing environment variables across the stack. Also triggered by: "환경변수 추가/삭제/확인/검사", "env-sync", "GitLab Variables 체크리스트", edits to `infra/env/` |
| `managing-skill-evolution` | `.agents/skills/managing-skill-evolution/SKILL.md` | Updating, reviewing, or versioning any project skill; when recent work reveals a mismatch between real code and skill rules |

### How to Use

1. Before any frontend work → read `frontend-storybook-architecture` SKILL.md first.
2. Before any backend Kotlin work → read `structuring-kotlin-ddd-code` SKILL.md first.
3. Before any env var change → read `env-sync` SKILL.md first.
4. When a skill feels outdated or wrong → read `managing-skill-evolution` SKILL.md first.

Each SKILL.md may reference additional files under its `references/` directory. Read those as directed by the skill.
