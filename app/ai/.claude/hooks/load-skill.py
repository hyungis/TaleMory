#!/usr/bin/env python
"""Auto-load project skills when this subdirectory is the project root.

- NATIVE_SKILL is always loaded when set. Currently None because no AI-specific
  skill is maintained yet (kept for parity with backend/frontend workspace hooks
  so adding one later is a one-line change).
- EXTRA_MAP adds conditional skills that load only when the Edit|Write target
  matches a given path token (e.g. editing infra/env/*.env triggers env-sync).

Each skill is injected at most once per session via a sentinel file.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

NATIVE_SKILL: str | None = None

EXTRA_MAP = [
    ("/infra/env/", "env-sync"),
]


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}

    session_id = payload.get("session_id") or "default"
    event_name = payload.get("hook_event_name") or "SessionStart"
    file_path = (payload.get("tool_input") or {}).get("file_path") or ""

    hook_dir = Path(__file__).resolve().parent
    repo_root = hook_dir.parents[3]

    sentinel_dir = hook_dir.parent / "cache" / "skill-loaded" / session_id
    sentinel_dir.mkdir(parents=True, exist_ok=True)

    candidates: list[str] = []

    if NATIVE_SKILL:
        candidates.append(NATIVE_SKILL)

    if file_path:
        norm = file_path.replace("\\", "/")
        for token, skill in EXTRA_MAP:
            if token in norm:
                candidates.append(skill)

    parts: list[str] = []
    for skill in candidates:
        sentinel = sentinel_dir / skill
        if sentinel.exists():
            continue
        skill_file = repo_root / ".agents" / "skills" / skill / "SKILL.md"
        if not skill_file.is_file():
            continue
        sentinel.touch()
        content = skill_file.read_text(encoding="utf-8")
        rel = f".agents/skills/{skill}/SKILL.md"
        parts.append(
            f"Auto-loaded project skill from {rel} (ai workspace):\n\n{content}"
        )

    if not parts:
        return 0

    out = {
        "hookSpecificOutput": {
            "hookEventName": event_name,
            "additionalContext": "\n\n---\n\n".join(parts),
        }
    }
    json.dump(out, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
