#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[jobops] all-sources batch starting"
echo "[jobops] repo: ${REPO_ROOT}"
echo "[jobops] mode: main Node pipeline"

cd "${REPO_ROOT}"

# Load .env if present
if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "${REPO_ROOT}/.env"
  set +o allexport
fi

export JOBOPS_SOURCE_SCOPE="${JOBOPS_SOURCE_SCOPE:-prompt}"
node scripts/jobops-sync-prompt-sources.mjs >/dev/null

node scripts/jobops-run-full-pipeline.mjs
node scripts/jobops-export-level1-report.mjs

echo "[jobops] latest all-sites markdown: tmp/jobops-pipeline/latest-all-sites-jobs.md"
echo "[jobops] latest level1 markdown:    tmp/jobops-pipeline/latest-level1-jobs.md"
echo "[jobops] latest summary:            tmp/jobops-pipeline/latest-summary.json"
