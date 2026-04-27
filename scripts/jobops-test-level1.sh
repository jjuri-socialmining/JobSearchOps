#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SCRIPT_RELATIVE_PATH="scripts/jobops-test-level1.sh"
TABLE_FILE="${REPO_ROOT}/automation/docs/jobsearchops-batches.md"
TABLE_HELPER="${REPO_ROOT}/scripts/jobops-batches-table.py"

get_table_field() {
  local field="$1"
  if [[ ! -f "${TABLE_FILE}" ]]; then
    return 0
  fi
  python3 "${TABLE_HELPER}" get --table "${TABLE_FILE}" --script "${SCRIPT_RELATIVE_PATH}" --field "${field}" 2>/dev/null || true
}

update_table_status() {
  local status="$1"
  local total="$2"
  local note="$3"
  local total_link="[${total}](../../tmp/jobops-pipeline/latest-level1-jobs.md)"
  python3 "${TABLE_HELPER}" update \
    --table "${TABLE_FILE}" \
    --script "${SCRIPT_RELATIVE_PATH}" \
    --set "status=${status}" \
    --set "nota=${note}" \
    --set "total ofertas=${total_link}" >/dev/null
}

load_runtime_inputs_from_table() {
  if [[ ! -f "${TABLE_FILE}" ]]; then
    return 0
  fi

  local keywords role max_posted_days excluded_post_keywords min_offers
  keywords="$(get_table_field "keywords")"
  role="$(get_table_field "rol")"
  max_posted_days="$(get_table_field "dias max posted")"
  excluded_post_keywords="$(get_table_field "keywords excluyentes aviso")"
  min_offers="$(get_table_field "min ofertas")"

  if [[ -n "${keywords}" ]]; then
    export JOBOPS_LEVEL1_KEYWORDS="${keywords}"
    echo "[jobops] keywords from table: ${JOBOPS_LEVEL1_KEYWORDS}"
  fi

  if [[ -n "${role}" && "${role}" != "—" ]]; then
    export JOBOPS_ROLE="${role}"
    echo "[jobops] role from table: ${JOBOPS_ROLE}"
  fi

  if [[ "${max_posted_days}" =~ ^[0-9]+$ ]]; then
    export JOBOPS_MAX_POSTED_DAYS="${max_posted_days}"
    echo "[jobops] max posted days from table: ${JOBOPS_MAX_POSTED_DAYS}"
  fi

  if [[ -n "${excluded_post_keywords}" && "${excluded_post_keywords}" != "—" ]]; then
    export JOBOPS_EXCLUDED_ANY_KEYWORDS="${excluded_post_keywords}"
    export JOBOPS_EXCLUDED_POST_KEYWORDS="${excluded_post_keywords}"
    echo "[jobops] excluded post keywords from table: ${JOBOPS_EXCLUDED_POST_KEYWORDS}"
  fi

  if [[ "${min_offers}" =~ ^[0-9]+$ ]]; then
    export JOBOPS_MIN_EXPECTED_OFFERS="${min_offers}"
    echo "[jobops] min expected offers from table: ${JOBOPS_MIN_EXPECTED_OFFERS}"
  fi
}

cd "${REPO_ROOT}"
load_runtime_inputs_from_table

if npm run jobops:test:level1; then
  total_offers="$(python3 - <<'PYEOF'
import json
from pathlib import Path

summary = Path("tmp/jobops-pipeline/latest-summary.json")
capture = Path("tmp/jobops-pipeline/latest-capture.json")

status = "exito ✅"
total = "0"
note = "sin incidencias"
minimum = int(__import__("os").environ.get("JOBOPS_MIN_EXPECTED_OFFERS", "0") or "0")

if summary.exists():
    data = json.loads(summary.read_text(encoding="utf-8"))
    total = str(data.get("job_count", 0))

if capture.exists():
    data = json.loads(capture.read_text(encoding="utf-8"))
    errors = data.get("errors") or []
    source_runs = data.get("source_runs") or []
    if source_runs:
        first = source_runs[0]
        raw = first.get("job_count_raw", 0)
        final = first.get("job_count_after_filters", 0)
        filtered = first.get("filtered_out_count", 0)
        note = f"{raw} raw -> {final} final; filtradas {filtered}"
    if errors:
        status = "bug: " + "; ".join(str(item.get("error", "error")) for item in errors[:2])
        note = "error HTTP/source; reintentar o usar fallback cache"
    elif minimum and int(total) < minimum:
        status = f"bug: por debajo del minimo esperado ({total}/{minimum})"
        note = note + "; relajar filtros o ampliar fuentes"

print(status)
print(total)
print(note)
PYEOF
  )"
  status_line="$(printf '%s\n' "${total_offers}" | sed -n '1p')"
  total_line="$(printf '%s\n' "${total_offers}" | sed -n '2p')"
  note_line="$(printf '%s\n' "${total_offers}" | sed -n '3p')"
  update_table_status "${status_line}" "${total_line}" "${note_line}"
else
  update_table_status "bug: runner failed" "0" "fallo del runner; revisar logs"
  exit 1
fi
