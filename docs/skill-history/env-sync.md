# env-sync — Skill History

## v0.3 - 2026-04-20

- Summary: Added `app/ai/.claude/` workspace config (`settings.json` + `load-skill.py`) so env-sync also auto-loads when Claude is invoked from `app/ai/` as CWD. The AI workspace currently has no native skill, so `NATIVE_SKILL = None` and only `EXTRA_MAP` fires.
- Reason: v0.2 closed the gap for `app/backend` and `app/frontend`, but `app/ai` had no `.claude/` workspace at all — any env-var work from there had zero skill context. Teammates doing FastAPI/Python work on `app/ai/` would miss env-sync's procedure entirely.
- Changed files:
  - `app/ai/.claude/settings.json` (new — mirrors backend/frontend wiring)
  - `app/ai/.claude/hooks/load-skill.py` (new — same `NATIVE_SKILL` + `EXTRA_MAP` shape, `NATIVE_SKILL = None`)
  - `docs/skill-history/env-sync.md` (this entry)
- User approval: Approved
- Impact: env-sync now auto-loads from all four workspaces (repo root, `app/backend`, `app/frontend`, `app/ai`) whenever a file under `infra/env/` is edited. When a dedicated AI skill is introduced later, swapping `NATIVE_SKILL = None` for the new skill name is the only change needed.

### Design Note — Nullable NATIVE_SKILL

Chosen over two alternatives:

1. **Skip creating `app/ai/.claude/` entirely.** Leaves the gap that triggered this update. Rejected.
2. **Create a placeholder AI skill (e.g. `python-fastapi-patterns`) now.** Premature — no stable conventions captured yet, and `managing-skill-evolution` requires explicit user approval to register new managed skills. Rejected.

`NATIVE_SKILL = None` keeps the hook structurally identical to the backend/frontend hooks (same file shape, same sentinel logic) so a future AI skill becomes a one-line swap rather than a restructure.

## v0.2 - 2026-04-20

- Summary: Extended sub-root hook scripts (`app/backend/.claude/hooks/load-skill.py`, `app/frontend/.claude/hooks/load-skill.py`) to auto-load `env-sync` when the `Edit|Write` target is under `infra/env/`, keeping the existing native skill (kotlin-ddd / storybook) loading unchanged.
- Reason: In v0.1 only the root-level `SKILL_MAP` triggered `env-sync`. If a teammate opened Claude from `app/backend/` or `app/frontend/` as CWD (which is common during feature work), the workspace-specific hook only loaded its native skill, so env-var tasks from those workspaces ran without the env-sync procedure in context. This gap meant env-sync's discipline (update `.env.example` + README + print GitLab Variables checklist; do not auto-edit service code) was skipped unless the user manually invoked the skill.
- Changed files:
  - `app/backend/.claude/hooks/load-skill.py` (rewritten with `NATIVE_SKILL` + `EXTRA_MAP` pattern)
  - `app/frontend/.claude/hooks/load-skill.py` (same pattern)
  - `docs/skill-history/env-sync.md` (this entry)
- User approval: Approved
- Impact: env-sync now auto-loads from any of three workspaces (repo root / `app/backend` / `app/frontend`) whenever a file under `infra/env/` is edited, within the same session-scoped sentinel guarantee (each skill injected at most once per session). `app/ai` still has no `.claude/` workspace config — env-var tasks from that directory require running Claude from repo root instead. The new sub-root hook structure is extensible: additional conditional skills can be added by appending entries to `EXTRA_MAP` in each sub-root hook.

### Design Note — why EXTRA_MAP pattern

Rejected alternatives:

1. **Always load env-sync in sub-root hooks (unconditional).** Wasteful — loads env-sync context even when the user is only editing app code. Context budget matters.
2. **Move all logic into a single shared library imported by every hook.** Cleaner but adds indirection; the project convention is standalone per-workspace hook scripts.
3. **Have the sub-root hook shell out to the root hook as a secondary invocation.** Fragile — hooks consume stdin and combining their stdout is not how the hook API is designed.

Chosen: in-script `EXTRA_MAP` per workspace. Small code duplication (~5 lines), no new inter-hook coupling, preserves existing "native skill always, extras on demand" intent.

## v0.1 - 2026-04-20

- Summary: Initial creation of the `env-sync` skill to automate environment-variable propagation and consistency audit across frontend, backend, ai, and infra.
- Reason: Environment variables are spread across four axes in S210 (React frontend, Spring backend, Python ai, Docker compose infra). Manual edits repeatedly cause:
  - missing keys in `.env.example` files → service fails in CI
  - code references without compose injection → runtime errors (recently observed as Flyway "Communications link failure" when `application.yml` used hardcoded values instead of `${DB_URL}`)
  - orphan keys in `.env.example` that nothing reads
  - divergence between GitLab CI/CD Variables and example files
- Changed files:
  - `.agents/skills/env-sync/SKILL.md`
  - `.agents/skills/env-sync/references/add-mode.md`
  - `.agents/skills/env-sync/references/check-mode.md`
  - `.agents/skills/env-sync/references/service-mapping.md`
  - `.agents/skills/env-sync/references/whitelist.md`
  - `.claude/hooks/load-project-skills.py` (added `/infra/env/` → `env-sync` to `SKILL_MAP`)
  - `.agents/skills/managing-skill-evolution/SKILL.md` (added `env-sync` to Managed Scope — Protected Area change)
  - `.agents/skills/managing-skill-evolution/references/managed-skills.md` (registered with path + history)
  - `docs/skill-history/env-sync.md` (this file)
- User approval: Approved
- Impact: Future env-variable work follows one of two auto-loaded flows. `add` mode updates `.env.example` + README + outputs a GitLab Variables checklist without touching service code. `check` mode audits code ↔ example drift and reports missing/orphan/scope issues. Service code (`application.yml`, React src/, Python app/) is intentionally NOT auto-edited — ownership stays with each service team. The hook auto-injects the skill when any `infra/env/` file is edited.

## Design Notes

These decisions are intentional and should not change without a new history entry:

- **Two modes (`add`, `check`) instead of one unified flow.** Add is write-oriented with clear side effects; check is read-only audit. Mixing them in one mode obscures which operations mutate state.
- **CWD independence via `git rev-parse --show-toplevel`.** The skill may be invoked from `app/backend`, `app/frontend`, `app/ai`, or repo root. Relative paths are forbidden in the skill's own logic.
- **Whitelist is externalized** to `references/whitelist.md` so adding new container images (e.g. Elasticsearch) doesn't require editing the skill's core logic — only the whitelist data file.
- **Single SKILL_MAP entry** (`/infra/env/` → env-sync). Not `/app/backend/` or `/app/frontend/` because those are claimed by their own skills and the hook takes first match only. If users want env-sync proactively from those paths, they invoke it explicitly.

## Known Limitations

- Scope-mismatch detection is MVP only (backend/frontend/ai code vs app/infra example files). It does not cross-validate dev vs master environment drift.
- Auto-fix scope is bounded to `.env.example` + `infra/env/README.md`. Service code edits remain manual by design.
- Python AI scan pattern (`os.getenv`, `os.environ`) may miss custom wrappers. Extend `references/check-mode.md` grep patterns if a wrapper is introduced.
