#!/usr/bin/env python
"""Auto-load the frontend-storybook skill when this subdirectory is the project root.

Fires on SessionStart and on Edit|Write. Injects the skill once per session.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

SKILL_NAME = "frontend-storybook-architecture"


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}

    session_id = payload.get("session_id") or "default"
    event_name = payload.get("hook_event_name") or "SessionStart"

    hook_dir = Path(__file__).resolve().parent
    repo_root = hook_dir.parents[3]
    skill_file = repo_root / ".agents" / "skills" / SKILL_NAME / "SKILL.md"
    if not skill_file.is_file():
        return 0

    sentinel_dir = hook_dir.parent / "cache" / "skill-loaded" / session_id
    sentinel_dir.mkdir(parents=True, exist_ok=True)
    sentinel = sentinel_dir / SKILL_NAME
    if sentinel.exists():
        return 0
    sentinel.touch()

    content = skill_file.read_text(encoding="utf-8")
    rel = f".agents/skills/{SKILL_NAME}/SKILL.md"
    out = {
        "hookSpecificOutput": {
            "hookEventName": event_name,
            "additionalContext": (
                f"Auto-loaded project skill from {rel} (frontend workspace):\n\n{content}"
            ),
        }
    }
    json.dump(out, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
