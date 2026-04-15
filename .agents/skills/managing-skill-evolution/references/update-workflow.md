# Update Workflow

## Flow A: Explicit Skill Update Request

Use this when the user directly asks to change a skill.

1. Ask which skill to modify.
2. Confirm that the recent task or requested change should be considered for rule change.
3. Show a before/after comparison of outcomes.
4. Ask whether the change is one-off or permanent.
5. Ask for final approval.
6. Only then edit the skill and version history.

## Flow B: Skill Drift Detected During Work

Use this when real work appears to conflict with a managed skill.

1. Notify the user that the recent work conflicts with current skill rules.
2. Suggest the most likely related skill.
3. Ask whether that skill is correct, or whether another managed skill should be used.
4. Confirm whether the recent work should become a rule.
5. Show a before/after comparison of outcomes.
6. Ask whether the change is one-off or permanent.
7. Ask for final approval.
8. Only then edit the skill and version history.

## Drift Detection Threshold

Do not treat every mismatch as a skill update candidate.

Treat recent work as meaningful skill drift when one or more of these are true:

- the same kind of exception appears 2 or more times in similar tasks for the same skill
- the user explicitly rejects a current skill rule or clearly instructs a different standard
- the current skill is repeatedly bypassed to achieve better structure, naming, boundaries, or review outcomes
- following the current skill produces results that clearly do not match the user's intent
- the current skill blocks progress or creates unnecessary workaround-heavy implementation
- the user directly asks for the skill rule itself to be changed

Treat a mismatch as a one-off exception when it appears only once, is highly situational, and is unlikely to guide future similar work.

## Conflict Detection Heuristics

Treat work as possible skill drift when one or more of these are true:

- the task repeatedly needs a different structure than the current skill recommends
- the user explicitly rejects a current skill rule
- a supposedly rare exception is becoming common
- the current skill blocks clearly better outcomes for the project
- recent work would be reviewed differently under the current skill than the user intends

## Outcome Comparison Rule

Do not compare only text changes.

Compare the likely work product instead:
- code organization
- boundary decisions
- naming results
- review outcomes
- state placement
- exports or packaging choices

## Before And After Comparison Format

When proposing a skill update, show the comparison in this format:

- Current skill outcome:
  Briefly describe what the current skill would lead to in the same task.
- Revised skill outcome:
  Briefly describe what the revised skill would lead to in the same task.
- Key difference:
  Explain the most important behavioral or structural difference.
- Why it matters:
  Explain why the revised outcome may better match the user's intent.

Prefer comparing concrete outcomes such as:
- folder placement
- state ownership
- naming
- public API exposure
- review decisions
- architecture boundaries

Do not compare only wording changes in the skill text unless the user explicitly asks for wording review.

## One-Off Exception Rule

Do not change the skill when:
- the request is highly situational
- the exception is unlikely to repeat
- the user wants only this task handled differently
- the change would weaken the skill's general quality

In those cases, note the exception in the conversation and leave the skill unchanged.

## One-Off Exception Handling

If the user says the change is needed only for the current task, do not edit the skill.

In that case:
- keep the current skill unchanged
- treat the decision as a task-specific exception
- briefly note in the conversation that the exception was handled as one-off
- do not create a version history entry for the skill

Only write a skill update and version history when the user confirms that the change should guide future similar work.

## Protected Area Rule

Treat these as protected areas:

- frontmatter `description`
- the skill's core philosophy or architectural stance
- managed scope
- versioning rules

If a proposed update touches any protected area:

- do not treat it as an ordinary skill update
- explicitly tell the user that the change affects a protected area
- ask for explicit approval for that protected area change
- proceed only after that explicit approval
