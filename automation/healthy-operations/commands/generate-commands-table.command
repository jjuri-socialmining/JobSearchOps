#!/usr/bin/env bash
set -euo pipefail

_SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Sube hasta encontrar dist/current (el directorio que es el target del symlink _gitops)
# _SELF = .../dist/current/automation/healthy-operations/commands
DIST_CURRENT="$(cd "${_SELF}/../../.." && pwd)"
GENERATE_SCRIPT="${DIST_CURRENT}/scripts/generate-commands-table.sh"

echo ""
echo "  Buscando repos que usan este dist/current como _gitops..."
echo "  dist/current: ${DIST_CURRENT}"
echo ""

FOUND=0
# Busca symlinks _gitops que apunten a este dist/current
while IFS= read -r link; do
  # Resuelve el target del symlink
  target_raw="$(readlink "${link}" 2>/dev/null)" || continue
  link_dir="$(dirname "${link}")"
  abs_target="$(cd "${link_dir}" && cd "${target_raw}" 2>/dev/null && pwd)" || continue

  if [[ "${abs_target}" == "${DIST_CURRENT}" ]]; then
    CALLER_REPO="${link_dir}"
    OUTPUT_FILE="${CALLER_REPO}/automation/healthy-operations/commands-table.md"

    echo "  ✅ Repo encontrado: ${CALLER_REPO}"
    echo "  Generando tabla y comandos..."

    bash "${GENERATE_SCRIPT}" "${CALLER_REPO}" "${OUTPUT_FILE}"

    echo ""
    echo "  Abre este archivo en Obsidian (NO via _gitops):"
    echo "  ${OUTPUT_FILE}"
    echo ""
    FOUND=$(( FOUND + 1 ))
  fi
done < <(find /Volumes -maxdepth 6 -name "_gitops" -type l 2>/dev/null)

if [[ "${FOUND}" -eq 0 ]]; then
  echo "  No se encontró ningún repo con _gitops → ${DIST_CURRENT}"
  echo "  Ejecuta manualmente desde la raíz de tu repo:"
  echo "    bash ./_gitops/scripts/generate-commands-table.sh"
fi
