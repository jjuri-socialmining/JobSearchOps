#!/usr/bin/env bash
set -euo pipefail

# Detecta el repo desde la ubicación física de este archivo (no via symlink)
_SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Guard: si está en dist/current es un template, no ejecutar desde aquí
if [[ "${_SELF}" == */dist/current/* ]]; then
  echo ""
  echo "  Este archivo es un TEMPLATE en dist/current."
  echo "  Genera los comandos para tu repo ejecutando UNA VEZ desde la raíz de tu repo:"
  echo ""
  echo "    bash ./_gitops/scripts/generate-commands-table.sh"
  echo ""
  echo "  Luego abre: automation/healthy-operations/commands-table.md (en TU repo)"
  echo ""
  exit 1
fi

REPO_ROOT="$(git -C "${_SELF}" rev-parse --show-toplevel 2>/dev/null)" \
  || { echo "[ERROR] ${_SELF} no está dentro de un repo git"; exit 1; }

TABLE_FILE="${REPO_ROOT}/automation/healthy-operations/commands-table.md"
TABLE_HELPER="${REPO_ROOT}/_gitops/scripts/table-helper.py"

cd "${REPO_ROOT}"

SCRIPT_KEY="scripts/link-project.sh"

START_TIME="$(date +%s)"
ULTIMO_RUN="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
TIME_LOCAL="$(date '+%Y-%m-%d %H:%M:%S')"
EXIT_CODE=0

bash ./_gitops/scripts/link-project.sh || EXIT_CODE=$?

END_TIME="$(date +%s)"
DURACION="$((END_TIME - START_TIME))s"
if [[ "${EXIT_CODE}" == "0" ]]; then
  STATUS="exito ✅"
else
  STATUS="error ❌ (exit ${EXIT_CODE})"
fi

if [[ -f "${TABLE_FILE}" && -f "${TABLE_HELPER}" ]]; then
  python3 "${TABLE_HELPER}" update \
    --table "${TABLE_FILE}" \
    --script "${SCRIPT_KEY}" \
    --set "status=${STATUS}" \
    --set "time=${TIME_LOCAL}" \
    --set "ultimo run=${ULTIMO_RUN}" \
    --set "duracion=${DURACION}" \
    --set "exit code=${EXIT_CODE}" 2>/dev/null || true
fi

exit "${EXIT_CODE}"
