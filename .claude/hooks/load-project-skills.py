#!/usr/bin/env python
"""Auto-load project skills when editing relevant files.

Injects each skill at most once per session via hookSpecificOutput.additionalContext.
Triggered as a PreToolUse hook on Edit|Write.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

SKILL_MAP = [
    ("/app/backend/", "structuring-kotlin-ddd-code"),
    ("/app/frontend/", "frontend-storybook-architecture"),
    ("/.agents/skills/", "managing-skill-evolution"),
    ("/infra/env/", "env-sync"),
]


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    file_path = (payload.get("tool_input") or {}).get("file_path") or ""
    session_id = payload.get("session_id") or "default"
    if not file_path:
        return 0

    norm = file_path.replace("\\", "/")
    skill_dir = next((name for token, name in SKILL_MAP if token in norm), None)
    if not skill_dir:
        return 0

    repo_root = Path(__file__).resolve().parents[2]
    skill_file = repo_root / ".agents" / "skills" / skill_dir / "SKILL.md"
    if not skill_file.is_file():
        return 0

    sentinel_dir = repo_root / ".claude" / "cache" / "skill-loaded" / session_id
    sentinel_dir.mkdir(parents=True, exist_ok=True)
    sentinel = sentinel_dir / skill_dir
    if sentinel.exists():
        return 0
    sentinel.touch()

    content = skill_file.read_text(encoding="utf-8")
    rel = f".agents/skills/{skill_dir}/SKILL.md"
    out = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": (
                f"Auto-loaded project skill from {rel} (edit target matched its scope):\n\n"
                f"{content}"
            ),
        }
    }
    json.dump(out, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
