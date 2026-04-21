---
name: managing-skill-evolution
description: Use when updating, reviewing, or maintaining frontend or Kotlin architecture skills in this project, especially when a recent task suggests the skill rules may need to change, a new skill should be managed, or version history should be recorded.
---

# Managing Skill Evolution

Use this skill to manage changes to project skills safely and deliberately.

This skill is for maintaining skill quality over time, not for editing product code directly. Use it when a user wants to revise a skill, when a recent task exposed a mismatch between real work and current skill rules, or when a new skill should be brought under management.

## Managed Scope

This skill currently manages:

- `frontend-storybook-architecture`
- `structuring-kotlin-ddd-code`
- `env-sync`

If a new skill appears under `.agents/skills`, read it and ask whether it should be added to managed scope before treating it as a maintained skill.

## Two Entry Flows

Use one of these two flows.

### Flow A: User explicitly asks to change a skill

Use this flow when the user says things like:
- "스킬 수정해줘"
- "이 규칙을 스킬에 반영해줘"
- "프론트 스킬 바꿔줘"
- "코틀린 스킬 업데이트해줘"

Follow this order:
1. Ask which skill to modify.
2. Confirm whether the proposed change should become a rule.
3. Show before/after outcome comparison.
4. Ask whether the change is one-off or permanent.
5. Ask for final approval before editing the skill and history.

### Flow B: Work drift suggests the skill may be outdated

Use this flow when recent work appears to conflict with an existing managed skill.

Follow this order:
1. Notify that the recent result conflicts with the current skill.
2. Suggest the most relevant skill.
3. Let the user confirm that skill or choose another managed skill.
4. Confirm whether the recent work should become a rule.
5. Show before/after outcome comparison.
6. Ask whether the change is one-off or permanent.
7. Ask for final approval before editing the skill and history.

## User-Facing Confirmation Prompts

Use these prompts in order, depending on the entry flow.

### Flow A prompts

- `어떤 스킬을 수정할까요?`
- `이번 작업에서 드러난 내용을 앞으로 스킬 규칙으로 반영해도 될까요?`
- `수정 전 스킬과 수정 후 스킬로 작업한 결과 차이가 이 방향이면 맞을까요?`
- `이건 이번 작업에만 필요한 예외일까요, 앞으로도 유지할 규칙일까요?`
- `그럼 이 내용을 실제로 스킬과 이력 문서에 반영할까요?`

### Flow B prompts

- `방금 작업 결과가 현재 스킬 규칙과 어긋납니다. 스킬 수정이 필요한지 확인해볼까요?`
- `이 작업과 가장 관련 있는 스킬은 <skill-name>으로 보입니다. 이 스킬을 기준으로 살펴볼까요, 아니면 다른 스킬인가요?`
- Show managed skill list immediately after that prompt.
- `이번 작업에서 드러난 내용을 앞으로 스킬 규칙으로 반영해도 될까요?`
- `수정 전 스킬과 수정 후 스킬로 작업한 결과 차이가 이 방향이면 맞을까요?`
- `이건 이번 작업에만 필요한 예외일까요, 앞으로도 유지할 규칙일까요?`
- `그럼 이 내용을 실제로 스킬과 이력 문서에 반영할까요?`

## Managed Skill List Behavior

When asking the user to choose or confirm a skill, show the current managed skill list.

Default list:
- `frontend-storybook-architecture`
- `structuring-kotlin-ddd-code`
- `env-sync`

If new skills exist under `.agents/skills`, mention them as additional candidates only after reading their `SKILL.md` and relevant references.

## Decision Rules

Follow these rules strictly:

- do not modify a skill before the user confirms the target skill
- do not treat every exception as a rule change
- do not update a skill just because one task felt inconvenient
- do not edit skill files before showing the before/after outcome comparison
- do not edit skill files before asking whether the change is one-off or permanent
- do not edit skill files or history until the user gives final approval

## Protected Areas

Treat these as protected areas.

Do not change them through ordinary skill updates without explicit approval for that protected area:

- frontmatter `description`
- the skill's core philosophy or architectural stance
- managed scope
- versioning rules

If a requested change touches one of these, call it out clearly before continuing and ask for explicit approval for that protected area change.

## Before/After Comparison Rule

When proposing a skill change, show the difference in resulting work, not just the wording change.

Prefer comparing:
- file placement
- naming outcomes
- public API exposure
- state ownership
- boundary decisions
- review behavior

If relevant, summarize:
- what the current skill would lead to
- what the revised skill would lead to
- why the difference matters

## One-Off vs Permanent Rule

Use these rules:

- if the change applies only to the current task, treat it as a one-off exception and do not modify the skill
- if the change should guide future similar work, treat it as a permanent rule candidate
- when unsure, ask the user and default to not changing the skill

## New Skill Intake

When a new skill is added under `.agents/skills`:

1. Read `SKILL.md`
2. Read relevant `references/*` only as needed
3. Summarize what the skill is for
4. Ask whether it should be managed by this skill
5. If approved, add it to managed scope and create a history document

Do not auto-edit or auto-register a new skill without user approval.

## Version History

Every approved permanent skill update must be recorded in:

- `docs/skill-history/<skill-name>.md`

Use the versioning and history rules in `references/versioning-rules.md`.

## References

Read these references as needed:

- managed targets and registration rules: `references/managed-skills.md`
- detailed update workflow: `references/update-workflow.md`
- version history rules and templates: `references/versioning-rules.md`
