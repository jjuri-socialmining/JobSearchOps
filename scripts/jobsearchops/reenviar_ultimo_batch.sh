#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BATCH_NAME="${BATCH_NAME:-buscar_trabajo_general_bc}"
RUNS_DIR="${RUNS_DIR:-${REPO_ROOT}/tmp/jobsearchops-runs}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

# Carga .env si existe
env_file="${REPO_ROOT}/.env"
if [[ -f "${env_file}" ]]; then
  set -a; source "${env_file}"; set +a
fi

if [[ -z "${N8N_WEBHOOK_URL:-}" ]]; then
  echo "ERROR: N8N_WEBHOOK_URL no está definida en .env" >&2
  exit 1
fi

# Encuentra el último run con joboffers-normalized.json
batch_dir="${RUNS_DIR}/${BATCH_NAME}"
if [[ ! -d "${batch_dir}" ]]; then
  echo "ERROR: No existe directorio de runs para '${BATCH_NAME}': ${batch_dir}" >&2
  exit 1
fi

latest_json="$(find "${batch_dir}" -name "joboffers-normalized.json" | sort | tail -1)"
if [[ -z "${latest_json}" ]]; then
  echo "ERROR: No se encontró ningún joboffers-normalized.json en ${batch_dir}" >&2
  exit 1
fi

run_id="$(basename "$(dirname "${latest_json}")")"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Reenviando run: ${run_id}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Archivo: ${latest_json}"

# Reenvía el JSON normalizado al webhook
"${PYTHON_BIN}" - <<EOF
import json, urllib.request, urllib.error, sys

with open('${latest_json}', encoding='utf-8') as f:
    payload = json.load(f)

data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(
    '${N8N_WEBHOOK_URL}',
    data=data,
    headers={'Content-Type': 'application/json'},
    method='POST'
)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode('utf-8', errors='replace')
        count = payload.get('count', '?')
        print(f"[OK] {count} ofertas enviadas a n8n — respuesta: {body[:200]}")
except urllib.error.URLError as e:
    print(f"[ERROR] No se pudo conectar con n8n: {e}", file=sys.stderr)
    sys.exit(1)
EOF
