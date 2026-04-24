#!/usr/bin/env node
// Auto-load project skills when this subdirectory is the project root.
// Ported from load-skill.py to avoid Windows Python App Execution Alias stub issues.
//
// - NATIVE_SKILL is always loaded (once per session) on SessionStart / Edit / Write.
// - EXTRA_MAP adds conditional skills that load only when the Edit|Write target
//   matches a given path token (e.g. editing infra/env/*.env triggers env-sync).
//
// Each skill is injected at most once per session via a sentinel file.

const fs = require('fs');
const path = require('path');

const NATIVE_SKILL = 'frontend-storybook-architecture';

const EXTRA_MAP = [
  ['/infra/env/', 'env-sync'],
];

const WORKSPACE = 'frontend';

function main() {
  let raw;
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch {
    return 0;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = {};
  }

  const sessionId = payload.session_id || 'default';
  const eventName = payload.hook_event_name || 'SessionStart';
  const filePath = (payload.tool_input && payload.tool_input.file_path) || '';

  // repo_root = 4 levels up from hook file.
  // .claude/hooks/load-skill.js → .claude/hooks → .claude → <workspace> → app → repo_root.
  const hookDir = __dirname;
  const repoRoot = path.resolve(hookDir, '..', '..', '..', '..');

  const sentinelDir = path.resolve(hookDir, '..', 'cache', 'skill-loaded', sessionId);
  fs.mkdirSync(sentinelDir, { recursive: true });

  const candidates = [];

  if (NATIVE_SKILL) {
    candidates.push(NATIVE_SKILL);
  }

  if (filePath) {
    const norm = filePath.replace(/\\/g, '/');
    for (const [token, skill] of EXTRA_MAP) {
      if (norm.includes(token)) candidates.push(skill);
    }
  }

  const parts = [];
  for (const skill of candidates) {
    const sentinel = path.join(sentinelDir, skill);
    if (fs.existsSync(sentinel)) continue;
    const skillFile = path.join(repoRoot, '.agents', 'skills', skill, 'SKILL.md');
    if (!fs.existsSync(skillFile) || !fs.statSync(skillFile).isFile()) continue;
    fs.writeFileSync(sentinel, '');
    const content = fs.readFileSync(skillFile, 'utf8');
    const rel = `.agents/skills/${skill}/SKILL.md`;
    parts.push(
      `Auto-loaded project skill from ${rel} (${WORKSPACE} workspace):\n\n${content}`
    );
  }

  if (parts.length === 0) return 0;

  const out = {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: parts.join('\n\n---\n\n'),
    },
  };
  process.stdout.write(JSON.stringify(out));
  return 0;
}

process.exit(main());
