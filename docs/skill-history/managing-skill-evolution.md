# managing-skill-evolution — Skill History

## v0.1 - 2026-04-20

- Summary: Retroactively opened a history file for `managing-skill-evolution` and added a `Hook Wiring Propagation` section to `references/update-workflow.md`.
- Reason: The project now has four parallel auto-load hook scripts that must stay in sync when a skill's triggering behavior changes (`.claude/hooks/load-project-skills.py`, plus `load-skill.py` in `app/backend/.claude/hooks/`, `app/frontend/.claude/hooks/`, `app/ai/.claude/hooks/`). Until now the update workflow offered no explicit rule for propagating a change across all four files, making silent workspace-specific drift the most likely failure mode (e.g. env-sync triggering from one CWD but not another). `env-sync` v0.2 and v0.3 already executed the pattern in practice; this rule formalizes it so future skill-infrastructure changes follow a written checklist.
- Changed files:
  - `.agents/skills/managing-skill-evolution/references/update-workflow.md` (added `Hook Wiring Propagation` section above `Protected Area Rule`)
  - `docs/skill-history/managing-skill-evolution.md` (this file — first history entry)
- User approval: Approved
- Impact: Any future skill update that changes hook auto-load behavior is expected to walk a 5-step checklist (decide scope → apply to every relevant hook → `grep -En "<skill-name>"` drift check → document scoping decision if partial → list all modified hook files in the skill's own history). The rule also warns that the root hook alone does not cover sub-workspace CWDs, making sub-workspace entries mandatory for repo-wide skills.

### Design Note — Why retroactive v0.1 rather than pretending a prior baseline existed

The skill pre-dates this history file. Per `references/versioning-rules.md`: "Use v0.1 both when a newly created skill is first registered for managed history, and when an already existing skill is added to managed history after the fact." This entry follows the latter reading. No attempt is made to reconstruct pre-v0.1 rule additions; the prior SKILL.md and references are treated as the v0.1 baseline, and this entry captures only the Hook Wiring Propagation addition because that is the first change made under explicit history discipline.

### Design Note — Why not also add managing-skill-evolution to its own Managed Scope

The skill's `Managed Scope` list currently contains `frontend-storybook-architecture`, `structuring-kotlin-ddd-code`, and `env-sync`. Adding the skill to its own scope would create a circular manager-of-manager responsibility and would be a Protected Area change requiring separate explicit approval. That change is intentionally out of scope for v0.1; it should be raised as a deliberate decision if and when the team wants self-governance of update rules.
