---
name: frontend-storybook-architecture
description: Use when adding, reviewing, refactoring, or organizing frontend code in this project, especially when deciding feature boundaries, shared placement, page responsibility, public API exports, state ownership, or React Query naming.
---

# Frontend Storybook Architecture

Use this skill to keep the frontend aligned with this project's feature-first architecture.

Default to these project rules:
- organize frontend code by domain and feature first
- keep `shared` minimal
- keep `pages` thin
- expose feature internals only through `index.ts`
- separate server state from UI state
- keep workflow state near the owning domain

This skill is for structural frontend decisions, not simple styling-only edits.

## Workflow

Follow this order:

1. Identify which domain the change belongs to.
2. Decide whether the code belongs in `pages`, `features`, `entities`, or `shared`.
3. Prefer keeping logic inside the owning feature first.
4. Move code to `shared` only when actual cross-feature reuse is confirmed.
5. Expose only stable public items through `index.ts`.
6. Separate server state, UI state, and workflow state.
7. Review naming, import boundaries, and domain placement before finishing.

## Fast Rules

Prefer these defaults unless the existing code strongly suggests otherwise:

- put user-facing behavior and workflow logic in `features`
- put domain data concepts in `entities`
- put route composition in `pages`
- put only truly common code in `shared`
- avoid external imports from feature internals
- use explicit React Query naming with `Query`, `Post`, `Delete`, and `Update`

## Allowed Exceptions

Allow these exceptions when justified:

- keep code inside a feature even if future reuse seems possible
- place cross-step workflow state in `story-creation/model`
- allow thin route-entry guards in `pages`
- preserve strong existing project consistency when strict rule application would create unnecessary churn
- prefer minimal structural improvement over large unrelated refactors

## How To Use References

Read references as needed:

- If structure or placement is unclear, read `references/architecture-rules.md`
- If domain ownership is unclear, read `references/domain-map.md`
- If naming is unclear, read `references/naming-conventions.md`
- Before finishing or reviewing, read `references/review-checklist.md`

When the project guide conflicts with generic frontend habits, follow the project guide.
