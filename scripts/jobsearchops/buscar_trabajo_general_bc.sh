#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SCRIPT_RELATIVE_PATH="scripts/jobsearchops/buscar_trabajo_general_bc.sh"
TABLE_FILE="${REPO_ROOT}/automation/docs/jobsearchops-batches.md"
TABLE_HELPER="${REPO_ROOT}/scripts/jobops-batches-table.py"

export BATCH_NAME="${BATCH_NAME:-buscar_trabajo_general_bc}"
export MODE="${MODE:-once}"
export START_HOUR="${START_HOUR:-22}"
export END_HOUR="${END_HOUR:-6}"
export INTERVAL_MINUTES="${INTERVAL_MINUTES:-60}"
export KEYWORDS_CONFIG="${KEYWORDS_CONFIG:-config/keywords.yaml}"
export DESTINATION="${DESTINATION:-tmp/jobops-pipeline/latest-all-sites-jobs.md}"
export JOBOPS_RUNTIME="${JOBOPS_RUNTIME:-node-main}"
export LEGACY_PROMPT_FLOW="${LEGACY_PROMPT_FLOW:-0}"

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
  local total_link="[${total}](../../tmp/jobops-pipeline/latest-all-sites-jobs.md)"
  python3 "${TABLE_HELPER}" update \
    --table "${TABLE_FILE}" \
    --script "${SCRIPT_RELATIVE_PATH}" \
    --set "status=${status}" \
    --set "nota=${note}" \
    --set "total ofertas=${total_link}" >/dev/null
}

load_runtime_inputs_from_table() {
  local keywords role max_posted_days excluded_post_keywords min_offers usa_filtro
  keywords="$(get_table_field "keywords")"
  role="$(get_table_field "rol")"
  max_posted_days="$(get_table_field "dias max posted")"
  excluded_post_keywords="$(get_table_field "keywords excluyentes aviso")"
  min_offers="$(get_table_field "min ofertas")"
  usa_filtro="$(get_table_field "usa filtro")"

  if [[ -n "${keywords}" && "${keywords}" != "—" ]]; then
    export JOBOPS_LEVEL1_KEYWORDS="${keywords}"
    echo "[jobsearchops] keywords from table: ${JOBOPS_LEVEL1_KEYWORDS}"
  fi

  if [[ -n "${role}" && "${role}" != "—" ]]; then
    export JOBOPS_ROLE="${role}"
    echo "[jobsearchops] role from table: ${JOBOPS_ROLE}"
  fi

  if [[ "${max_posted_days}" =~ ^[0-9]+$ ]]; then
    export JOBOPS_MAX_POSTED_DAYS="${max_posted_days}"
    echo "[jobsearchops] max posted days from table: ${JOBOPS_MAX_POSTED_DAYS}"
  fi

  if [[ -n "${excluded_post_keywords}" && "${excluded_post_keywords}" != "—" ]]; then
    export JOBOPS_EXCLUDED_ANY_KEYWORDS="${excluded_post_keywords}"
    export JOBOPS_EXCLUDED_POST_KEYWORDS="${excluded_post_keywords}"
    echo "[jobsearchops] excluded post keywords from table: ${JOBOPS_EXCLUDED_POST_KEYWORDS}"
  fi

  if [[ "${min_offers}" =~ ^[0-9]+$ ]]; then
    export JOBOPS_MIN_EXPECTED_OFFERS="${min_offers}"
    echo "[jobsearchops] min expected offers from table: ${JOBOPS_MIN_EXPECTED_OFFERS}"
  fi

  if [[ "${usa_filtro,,}" == "si" || "${usa_filtro,,}" == "yes" || "${usa_filtro}" == "1" ]]; then
    export JOBOPS_DISABLE_EXCLUSIONS="0"
    echo "[jobsearchops] usa filtro: exclusiones activas"
  else
    export JOBOPS_DISABLE_EXCLUSIONS="1"
    echo "[jobsearchops] usa filtro: exclusiones desactivadas"
  fi
}

usage() {
  cat <<'EOF'
Usage:
  scripts/jobsearchops/buscar_trabajo_general_bc.sh

Environment:
  MODE=once|window
  START_HOUR=22
  END_HOUR=6
  INTERVAL_MINUTES=60
  JOBOPS_RUNTIME=node-main|legacy-prompt
  LEGACY_PROMPT_FLOW=1   # fuerza el wrapper anterior basado en prompt
EOF
}

validate_config() {
  if [[ ! "${MODE}" =~ ^(once|window)$ ]]; then
    echo "MODE must be once or window." >&2
    exit 1
  fi

  if ! [[ "${START_HOUR}" =~ ^([0-9]|1[0-9]|2[0-3])$ ]]; then
    echo "START_HOUR must be an integer between 0 and 23." >&2
    exit 1
  fi

  if ! [[ "${END_HOUR}" =~ ^([0-9]|1[0-9]|2[0-3])$ ]]; then
    echo "END_HOUR must be an integer between 0 and 23." >&2
    exit 1
  fi

  if ! [[ "${INTERVAL_MINUTES}" =~ ^[1-9][0-9]*$ ]]; then
    echo "INTERVAL_MINUTES must be a positive integer." >&2
    exit 1
  fi
}

minute_of_day() {
  local hour="$1"
  local minute="$2"
  echo $((10#${hour} * 60 + 10#${minute}))
}

is_in_window() {
  local now_h now_m start_min end_min now_min
  now_h="$(date +%H)"
  now_m="$(date +%M)"
  now_min="$(minute_of_day "${now_h}" "${now_m}")"
  start_min=$((10#${START_HOUR} * 60))
  end_min=$((10#${END_HOUR} * 60))

  if (( start_min == end_min )); then
    return 0
  fi

  if (( start_min < end_min )); then
    (( now_min >= start_min && now_min < end_min ))
    return
  fi

  (( now_min >= start_min || now_min < end_min ))
}

seconds_until_window_start() {
  local now_h now_m now_min start_min delta
  now_h="$(date +%H)"
  now_m="$(date +%M)"
  now_min="$(minute_of_day "${now_h}" "${now_m}")"
  start_min=$((10#${START_HOUR} * 60))

  if (( now_min <= start_min )); then
    delta=$((start_min - now_min))
  else
    delta=$(((24 * 60 - now_min) + start_min))
  fi

  echo $((delta * 60))
}

run_jobops_once() {
  cd "${REPO_ROOT}"
  node scripts/jobops-sync-prompt-sources.mjs >/dev/null
  load_runtime_inputs_from_table
  echo "[jobsearchops] batch: ${BATCH_NAME}"
  echo "[jobsearchops] runtime: ${JOBOPS_RUNTIME}"
  echo "[jobsearchops] keywords: ${KEYWORDS_CONFIG}"

  if [[ "${LEGACY_PROMPT_FLOW}" == "1" || "${JOBOPS_RUNTIME}" == "legacy-prompt" ]]; then
    echo "[jobsearchops] using legacy prompt flow"
    exec "${SCRIPT_DIR}/run_prompt_batch_to_n8n.sh"
  fi

  echo "[jobsearchops] using main Node pipeline across configured sources"
  if npm run jobops:all-sites; then
    result="$(
      python3 - <<'PYEOF'
import json
from pathlib import Path

summary = Path("tmp/jobops-pipeline/latest-summary.json")
status = "exito ✅"
total = "0"
note = "sin incidencias"
minimum = int(__import__("os").environ.get("JOBOPS_MIN_EXPECTED_OFFERS", "0") or "0")
per_site_mode = (__import__("os").environ.get("JOBOPS_DISABLE_EXCLUSIONS", "0") == "1")

def compact_source_note(item):
    source_id = str(item.get("source_id") or item.get("source_name") or "source")
    source_status = str(item.get("status") or "")
    final_jobs = int(item.get("job_count_after_filters") or 0)
    detail = str(item.get("status_note") or "").strip()

    if source_status == "CAPTURED":
        return f"{source_id}: {final_jobs}"
    if source_status == "NO_RESULTS":
        return f"{source_id}: 0 resultados"
    if source_status == "ERROR":
        return f"{source_id}: error {detail or 'desconocido'}"
    if source_status == "SKIPPED_UNCONFIGURED":
        return f"{source_id}: no configurado"
    return f"{source_id}: {source_status.lower() or 'sin estado'}"

if summary.exists():
    data = json.loads(summary.read_text(encoding="utf-8"))
    total = str(data.get("job_count", 0))
    source_runs = data.get("source_runs") or []
    issue_sources = []
    issue_notes = []
    active_source_runs = [item for item in source_runs if item.get("configured")]
    for item in active_source_runs:
        if item.get("status") == "ERROR":
            issue_sources.append(str(item.get("source_id") or item.get("source_name") or "source"))
            issue_notes.append(str(item.get("status_note") or "error"))
    if active_source_runs:
        configured = len(active_source_runs)
        captured = sum(int(item.get("job_count_after_filters") or 0) for item in active_source_runs)
        source_notes = "; ".join(compact_source_note(item) for item in active_source_runs)
        note = f"{configured} fuentes configuradas; {captured} ofertas finales; {source_notes}"
        if per_site_mode and configured:
            minimum = minimum * configured
            note = note + f"; objetivo {minimum} ({configured} x {minimum // configured})"
    if issue_sources:
        status = "bug: " + "; ".join(f"{source} fetch failed" for source in issue_sources[:2])
        note = note + "; completar fuentes y robustecer fuentes con error"
    elif minimum and int(total) < minimum:
        status = f"bug: por debajo del minimo esperado ({total}/{minimum})"
        note = note + "; faltan fuentes o filtros demasiado estrictos"

print(status)
print(total)
print(note)
PYEOF
    )"
    status_line="$(printf '%s\n' "${result}" | sed -n '1p')"
    total_line="$(printf '%s\n' "${result}" | sed -n '2p')"
    note_line="$(printf '%s\n' "${result}" | sed -n '3p')"
    update_table_status "${status_line}" "${total_line}" "${note_line}"
  else
    update_table_status "bug: runner failed" "0" "fallo del runner; revisar logs"
    return 1
  fi
}

run_window_mode() {
  while true; do
    if is_in_window; then
      run_jobops_once
      sleep "$((INTERVAL_MINUTES * 60))"
      continue
    fi

    local wait_seconds
    wait_seconds="$(seconds_until_window_start)"
    echo "[jobsearchops] outside window; sleeping ${wait_seconds}s until next run"
    sleep "${wait_seconds}"
  done
}

validate_config

if [[ "${MODE}" == "once" ]]; then
  run_jobops_once
else
  run_window_mode
fi
