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

SCRIPT_KEY="scripts/check-repo.sh"
RAMA="$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'desconocida')"
HEAD_SHA="$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo '?')"
REMOTO="$(git -C "${REPO_ROOT}" remote get-url origin 2>/dev/null || echo 'sin remoto')"
ST="$(git -C "${REPO_ROOT}" status --short 2>/dev/null)"
NOW="$(date '+%Y-%m-%d %H:%M:%S')"
NOW_UTC="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

echo ""
echo "=============================================="
echo "  REPO ACTIVO"
echo "=============================================="
echo "  Ruta:   ${REPO_ROOT}"
echo "  Rama:   ${RAMA}"
echo "  HEAD:   ${HEAD_SHA}"
echo "  Remoto: ${REMOTO}"
echo "  Time:   ${NOW}"
echo "----------------------------------------------"
if [[ -z "${ST}" ]]; then
  echo "  tree:   limpio ✅"
else
  echo "  tree:   con cambios"
  printf '%s\n' "${ST}"
fi
echo "=============================================="
echo ""

if [[ -f "${TABLE_FILE}" && -f "${TABLE_HELPER}" ]]; then
  python3 "${TABLE_HELPER}" update \
    --table "${TABLE_FILE}" \
    --script "${SCRIPT_KEY}" \
    --set "status=${REPO_ROOT}" \
    --set "time=${NOW}" \
    --set "ultimo run=${NOW_UTC}" \
    --set "duracion=—" \
    --set "exit code=0" 2>/dev/null || true
fi
