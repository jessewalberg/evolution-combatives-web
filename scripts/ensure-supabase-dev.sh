#!/usr/bin/env bash
set -euo pipefail

EXPECTED_REF="hknjeztslvbenmlaqfqa"
PROJECT_REF_FILE="$(cd "$(dirname "$0")/.." && pwd)/supabase/.temp/project-ref"

if [[ ! -f "$PROJECT_REF_FILE" ]]; then
  echo "Supabase project link not found. Run: supabase link --project-ref ${EXPECTED_REF}" >&2
  exit 1
fi

CURRENT_REF="$(cat "$PROJECT_REF_FILE")"
if [[ "$CURRENT_REF" != "$EXPECTED_REF" ]]; then
  echo "Supabase project-ref is '${CURRENT_REF}', expected '${EXPECTED_REF}' (dev)." >&2
  echo "Run: supabase link --project-ref ${EXPECTED_REF}" >&2
  echo "If you intended to target prod, set FORCE_PROD=1 to bypass this check." >&2
  if [[ "${FORCE_PROD:-}" != "1" ]]; then
    exit 1
  fi
fi
