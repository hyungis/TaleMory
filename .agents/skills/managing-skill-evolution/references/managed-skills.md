# Managed Skills

## Current Managed Skills

These skills are currently under active maintenance:

- `frontend-storybook-architecture`
  - path: `.agents/skills/frontend-storybook-architecture/SKILL.md`
  - history: `docs/skill-history/frontend-storybook-architecture.md`
- `structuring-kotlin-ddd-code`
  - path: `.agents/skills/structuring-kotlin-ddd-code/SKILL.md`
  - history: `docs/skill-history/structuring-kotlin-ddd-code.md`
- `env-sync`
  - path: `.agents/skills/env-sync/SKILL.md`
  - history: `docs/skill-history/env-sync.md`

## Scope Rule

Only managed skills use the full evolution workflow by default.

For unmanaged skills:
- they may be read
- they may be summarized
- they may be proposed for registration
- they must not be auto-edited as managed skills until the user approves registration

## Registration Rule

When a new skill appears under `.agents/skills`, treat it as a candidate.

Follow this process:
1. Read its `SKILL.md`
2. Read relevant references if needed
3. Summarize what it covers
4. Ask whether it should be managed
5. If approved, add:
   - the skill name
   - the skill path
   - the history document path

## Managed Skill Display Rule

Whenever the user must choose a target skill, show the current managed skill list.

If there is a likely target skill, suggest it first, but always allow choosing another skill from the list.
