#!/usr/bin/env node
// PreToolUse hook — auto-load project skills when editing relevant files.
// Injects each skill at most once per session via hookSpecificOutput.additionalContext.
// Triggered as a PreToolUse hook on Edit|Write.
//
// Cross-platform (Node.js): works identically on Windows Git Bash / macOS / Linux
// without depending on Python or jq.

const fs = require('fs');
const path = require('path');

const SKILL_MAP = [
  ['/app/backend/',     'structuring-kotlin-ddd-code'],
  ['/app/frontend/',    'frontend-storybook-architecture'],
  ['/.agents/skills/',  'managing-skill-evolution'],
  ['/infra/env/',       'env-sync'],
];

function main() {
  // Read entire stdin (Claude Code provides a JSON blob).
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
    return 0;
  }

  const filePath = (payload.tool_input && payload.tool_input.file_path) || '';
  const sessionId = payload.session_id || 'default';
  if (!filePath) return 0;

  const norm = filePath.replace(/\\/g, '/');
  const match = SKILL_MAP.find(([token]) => norm.includes(token));
  if (!match) return 0;
  const skillDir = match[1];

  // repo_root = <hookFile>/../..  (= .claude/hooks/ -> .claude/ -> repo root)
  const repoRoot = path.resolve(__dirname, '..', '..');
  const skillFile = path.join(repoRoot, '.agents', 'skills', skillDir, 'SKILL.md');
  if (!fs.existsSync(skillFile) || !fs.statSync(skillFile).isFile()) return 0;

  // Sentinel — one injection per (session_id, skill) pair.
  const sentinelDir = path.join(repoRoot, '.claude', 'cache', 'skill-loaded', sessionId);
  fs.mkdirSync(sentinelDir, { recursive: true });
  const sentinel = path.join(sentinelDir, skillDir);
  if (fs.existsSync(sentinel)) return 0;
  fs.writeFileSync(sentinel, '');

  const content = fs.readFileSync(skillFile, 'utf8');
  const rel = `.agents/skills/${skillDir}/SKILL.md`;
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext:
        `Auto-loaded project skill from ${rel} (edit target matched its scope):\n\n` +
        content,
    },
  };
  process.stdout.write(JSON.stringify(out));
  return 0;
}

process.exit(main());
