#!/usr/bin/env bash
# Send a Discord embed notification for the current CI job.
# Called from .gitlab-ci.yml .post stage (notify_success / notify_failure).
#
# Required env:
#   DISCORD_WEBHOOK_URL  (masked GitLab Variable)
#   CI_JOB_STATUS, CI_JOB_NAME, CI_JOB_STAGE, CI_COMMIT_BRANCH, etc. (GitLab auto)
# Optional:
#   FAILURE_LOG_DIR      (set by deploy-service.sh trap)

set -euo pipefail

if ! command -v jq >/dev/null; then
  echo "jq is required for notify.sh. Install in before_script: apt-get install -y jq" >&2
  exit 1
fi

STATUS="${CI_JOB_STATUS:-unknown}"
JOB="${CI_JOB_NAME:-unknown}"
STAGE="${CI_JOB_STAGE:-unknown}"
BRANCH="${CI_COMMIT_BRANCH:-${CI_COMMIT_REF_NAME:-unknown}}"
PROJECT="${CI_PROJECT_PATH:-unknown}"
JOB_URL="${CI_JOB_URL:-}"
PIPELINE_URL="${CI_PIPELINE_URL:-}"
COMMIT_SHORT="${CI_COMMIT_SHORT_SHA:-unknown}"
COMMIT_TITLE="${CI_COMMIT_TITLE:-}"
AUTHOR="${GITLAB_USER_NAME:-${GITLAB_USER_LOGIN:-unknown}}"
WEBHOOK_URL="${DISCORD_WEBHOOK_URL:?DISCORD_WEBHOOK_URL not set}"

case "$STATUS" in
  success)  COLOR=3066993;  PREFIX="✅ SUCCESS" ;;
  failed)   COLOR=15158332; PREFIX="❌ FAILED"  ;;
  canceled) COLOR=9807270;  PREFIX="⏹️ CANCELED" ;;
  *)        COLOR=3447003;  PREFIX="ℹ️ $STATUS" ;;
esac

FOOTER_TEXT="${FAILURE_LOG_DIR:+logs: $FAILURE_LOG_DIR}"

PAYLOAD=$(jq -n \
  --arg title    "$PREFIX · $JOB" \
  --arg url      "$JOB_URL" \
  --arg desc     "**$PROJECT** / \`$BRANCH\` @ \`$COMMIT_SHORT\`
$COMMIT_TITLE" \
  --arg stage    "$STAGE" \
  --arg author   "$AUTHOR" \
  --arg pipeline "$PIPELINE_URL" \
  --arg footer   "$FOOTER_TEXT" \
  --argjson color "$COLOR" \
  --arg ts       "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{
    embeds: [{
      title: $title,
      url: (if $url == "" then null else $url end),
      description: $desc,
      color: $color,
      fields: [
        { name: "stage",        value: $stage,  inline: true },
        { name: "triggered by", value: $author, inline: true },
        { name: "pipeline",     value: (if $pipeline == "" then "-" else $pipeline end), inline: false }
      ],
      footer: (if $footer == "" then null else { text: $footer } end),
      timestamp: $ts
    }]
  }')

TMPFILE="$(mktemp)"
trap 'rm -f "$TMPFILE"' EXIT
printf '%s' "$PAYLOAD" > "$TMPFILE"

if ! jq . "$TMPFILE" > /dev/null 2>&1; then
  echo "notify.sh: generated payload is not valid JSON" >&2
  exit 1
fi

curl -fsS -X POST \
  -H 'Content-Type: application/json; charset=utf-8' \
  --data-binary "@$TMPFILE" \
  "$WEBHOOK_URL" >/dev/null
