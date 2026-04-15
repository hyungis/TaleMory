# Versioning Rules

## History File Location

Record permanent skill changes in:

- `docs/skill-history/<skill-name>.md`

Examples:
- `docs/skill-history/frontend-storybook-architecture.md`
- `docs/skill-history/structuring-kotlin-ddd-code.md`

## Required History Fields

Each history entry should include:

- version
- date
- summary
- reason
- changed files
- user approval status
- impact on future work

## Versioning Guidance

Use simple human-readable versioning:

- `v0.1`: first managed version or first history entry
- `v0.2`, `v0.3`, ...: meaningful pre-stable updates while the skill is still being refined
- `v1.0`: first stable version accepted as a team-facing baseline
- `v1.1`, `v1.2`, ...: later stable rule or workflow updates

Use `v0.x` while the skill is still settling.
Move to `v1.0` when the skill is considered stable enough to serve as a dependable default.

Examples:
- `v0.1 -> v0.2` for an additional rule, exception, or workflow improvement during refinement
- `v0.3 -> v1.0` when the skill becomes the stable baseline
- `v1.0 -> v1.1` for a later stable update

## History Entry Template

Use this template:

```md
## v0.2 - 2026-04-15

- Summary: Added explicit one-off vs permanent decision step.
- Reason: Recent skill-update workflow needed a safer approval process.
- Changed files:
  - `.agents/skills/<skill-name>/SKILL.md`
  - `.agents/skills/<skill-name>/references/<file>.md`
- User approval: Approved
- Impact: Future updates now require explicit permanence confirmation before editing the skill.
```

## Approval Rule

Do not write a permanent history entry unless the user has approved the actual skill update.

## Initial Version Rule

When a skill is first added to managed history, start at `v0.1`.

Use `v0.1` both when:
- a newly created skill is first registered for managed history
- an already existing skill is added to managed history after the fact

Do not use `v0.0.1`.
