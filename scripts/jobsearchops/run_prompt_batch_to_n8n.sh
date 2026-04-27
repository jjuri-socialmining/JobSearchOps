#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

MODE="${MODE:-once}"
START_HOUR="${START_HOUR:-22}"
END_HOUR="${END_HOUR:-6}"
INTERVAL_MINUTES="${INTERVAL_MINUTES:-60}"
MODEL="${MODEL:-gpt-4o}"
BATCH_NAME="${BATCH_NAME:-jobsearchops-batch}"
PROMPT_FILE="${PROMPT_FILE:-}"
RUNS_DIR="${RUNS_DIR:-${REPO_ROOT}/tmp/jobsearchops-runs}"
CODEX_BIN="${CODEX_BIN:-codex}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
TOKEN_LIMIT="${TOKEN_LIMIT:-30000}"
SOURCE_SLEEP_SECONDS="${SOURCE_SLEEP_SECONDS:-60}"
TROUBLESHOOTING="${TROUBLESHOOTING:-off}"
SOURCES_FILE="${REPO_ROOT}/automation/sources/jobsearchops-sources.json"

usage() {
  cat <<'EOF'
Usage:
  PROMPT_FILE=prompts/jobops/example.prompt.md scripts/jobsearchops/run_prompt_batch_to_n8n.sh

Environment:
  MODE=once|window
  START_HOUR=22
  END_HOUR=6
  INTERVAL_MINUTES=60
  MODEL=gpt-4o
  BATCH_NAME=buscar_trabajo_general_bc
  PROMPT_FILE=prompts/jobops/archivo.prompt.md
  N8N_WEBHOOK_URL=https://...
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

load_env_file() {
  local env_file="${REPO_ROOT}/.env"
  if [[ -f "${env_file}" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "${env_file}"
    set +a
  fi
}

validate_config() {
  if [[ -z "${PROMPT_FILE}" ]]; then
    echo "PROMPT_FILE is required." >&2
    usage >&2
    exit 1
  fi

  if [[ ! -f "${REPO_ROOT}/${PROMPT_FILE}" && ! -f "${PROMPT_FILE}" ]]; then
    echo "Prompt file not found: ${PROMPT_FILE}" >&2
    exit 1
  fi

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

resolve_prompt_file() {
  if [[ -f "${PROMPT_FILE}" ]]; then
    printf '%s\n' "${PROMPT_FILE}"
  else
    printf '%s\n' "${REPO_ROOT}/${PROMPT_FILE}"
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

log_step() {
  local pct="$1" msg="$2" log_file="$3"
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[${ts}] [${pct}%] ${msg}"
  printf '| %s | %s%% | %s |\n' "${ts}" "${pct}" "${msg}" >> "${log_file}"
}

# ── Construye un prompt enfocado en una sola fuente ───────────────────────────
build_source_prompt() {
  local prompt_abs="$1"
  local src_label="$2"
  local src_urls="$3"   # separadas por newline

  SRC_PROMPT_FILE="${prompt_abs}" \
  SRC_LABEL="${src_label}" \
  SRC_URLS="${src_urls}" \
  "${PYTHON_BIN}" - <<'PYEOF'
import os, re

prompt_file  = os.environ["SRC_PROMPT_FILE"]
src_label    = os.environ["SRC_LABEL"]
src_urls_raw = os.environ["SRC_URLS"]

text = open(prompt_file, encoding="utf-8").read()

# Sección de perfil (antes de ## Fuentes)
fuentes_idx = text.find("## Fuentes")
profile = text[:fuentes_idx].strip() if fuentes_idx >= 0 else text

# Sección de reglas de salida (desde ## Reglas de antigüedad en adelante)
m = re.search(r"^## Reglas de antig", text, re.MULTILINE)
rules = text[m.start():].strip() if m else ""

url_lines = [u.strip() for u in src_urls_raw.splitlines() if u.strip()]
url_block  = "\n".join(f"   - {u}" for u in url_lines)

print(f"""{profile}

## Fuente — busca solo aqui

{src_label}
{url_block}

Reglas adicionales para esta búsqueda:
- Visita SOLO estas URLs, no uses otras fuentes
- Si no hay resultados relevantes, devuelve un array JSON vacio: []

{rules}""")
PYEOF
}

# ── Countdown visible entre fuentes ──────────────────────────────────────────
sleep_with_countdown() {
  local seconds="$1"
  local from_label="$2"
  local i
  echo ""
  for (( i=seconds; i>0; i-- )); do
    printf "\r  ⏳ %ds — próxima fuente en espera (después de: %s) ..." "${i}" "${from_label}"
    sleep 1
  done
  printf "\r  ✅ Continuando...%-60s\n" ""
}

# ── Agrega tabla por source al MD progresivo (solo si hay resultados) ─────────
append_source_table() {
  local md_file="$1"
  local src_label="$2"
  local normalized_json="$3"

  MD_FILE="${md_file}" \
  SRC_LABEL="${src_label}" \
  NORM_JSON="${normalized_json}" \
  "${PYTHON_BIN}" - <<'PYEOF'
import json, os, sys
from pathlib import Path

data = json.loads(Path(os.environ["NORM_JSON"]).read_text(encoding="utf-8"))
rows = data.get("rows", [])
if not rows:
    sys.exit(0)

columns   = data.get("columns", [])
header    = "| " + " | ".join(columns) + " |"
separator = "| " + " | ".join(["---"] * len(columns)) + " |"
body = []
for row in rows:
    cells = [str(row.get(c, "")).replace("|", "\\|").replace("\n", " ") for c in columns]
    body.append("| " + " | ".join(cells) + " |")

table = "\n".join([header, separator] + body)

with open(os.environ["MD_FILE"], "a", encoding="utf-8") as f:
    f.write(f"\n## {os.environ['SRC_LABEL']}\n\n")
    f.write(table)
    f.write("\n")
PYEOF
}

# ── Prompt mínimo para troubleshooting (BC Gov, manager, 7 días) ──────────────
build_troubleshooting_prompt() {
  cat <<'TEOF'
Busca ofertas de trabajo en British Columbia, Canada, publicadas en los últimos 7 días.

Usa SOLO esta fuente directa:
   - https://bcpublicservice.hua.hrsmart.com/hr/ats/JobSearch/index

Busca cualquier rol con "Manager" en el título.

Reglas:
- Devuelve SOLO ofertas de los últimos 7 días
- Devuelve entre 10 y 15 ofertas en un array JSON válido
- Sin texto extra, sin markdown, solo el array JSON

Cada objeto usa exactamente estas claves:
- Version: "1"
- Schema Version: "joboffers.v1"
- Alias: slug corto empresa-titulo
- Date: fecha actual YYYY-MM-DD
- Posted: fecha o texto relativo si disponible, vacío si no
- Industry: sector de la organización
- N Applicants: número si visible, vacío si no
- Ranking: entero 1-100 (encaje con perfil de gestión)
- Prioridad: "alta" si Ranking >= 80, "media" si 60-79, "baja" si < 60
- Veredicto: "APPLY" si todo está claro, "APPLY ONLY IF CLARIFIED" si falta info
- Organización: nombre exacto
- Título: título exacto del rol
- Ubicación / Modalidad: ciudad + presencial/híbrido/remoto
- Compensación: rango si publicado, vacío si no
- Por qué mirar esto primero: razón concreta
- Qué te falta validar antes de invertir tiempo: preguntas abiertas
- Link: URL directa de la oferta, vacío si no hay URL directa
TEOF
}

# ── Loop principal por fuente ─────────────────────────────────────────────────
run_all_sources() {
  local prompt_abs run_id run_dir log_file progressive_md exporter monitor
  local cumulative_tokens=0 total_offers=0

  prompt_abs="$(resolve_prompt_file)"
  run_id="$(date +%Y%m%dT%H%M%S)"
  run_dir="${RUNS_DIR}/${BATCH_NAME}/${run_id}"
  log_file="${run_dir}/run.log.md"
  progressive_md="${run_dir}/joboffers-by-source.md"
  exporter="${SCRIPT_DIR}/post_job_offers_to_n8n.py"
  monitor="${SCRIPT_DIR}/codex_progress_monitor.py"

  mkdir -p "${run_dir}"

  # Inicializa log
  cat > "${log_file}" <<EOF
# Run Log — ${BATCH_NAME}

**Run ID:** ${run_id}
**Modelo:** ${MODEL}
**Token Limit:** ${TOKEN_LIMIT}
**Prompt:** ${prompt_abs}
**Inicio:** $(date '+%Y-%m-%d %H:%M:%S')

| Timestamp | Progreso | Paso |
| --- | --- | --- |
EOF

  # Inicializa MD progresivo
  cat > "${progressive_md}" <<EOF
# JobOffers — ${BATCH_NAME} — ${run_id}

Generado: $(date '+%Y-%m-%d %H:%M:%S') | Modelo: ${MODEL}

EOF

  log_step 0 "Iniciando '${BATCH_NAME}'" "${log_file}"
  log_step 5 "Prompt: $(basename "${prompt_abs}")" "${log_file}"

  # Lee fuentes del JSON (id TAB label TAB urls_pipe_separated)
  local source_data
  source_data="$(SOURCES_FILE="${SOURCES_FILE}" "${PYTHON_BIN}" - <<'PYEOF'
import json, os
with open(os.environ["SOURCES_FILE"]) as f:
    data = json.load(f)
sources = sorted(data["sources"], key=lambda s: s.get("priority", 99))
for s in sources:
    if s.get("mode") == "overlay":
        continue
    urls = "|".join(s.get("urls", []) + s.get("search_hints", []))
    print(s["id"] + "\t" + s["label"] + "\t" + urls)
PYEOF
)"

  local -a src_ids=() src_labels=() src_urls_arr=()
  while IFS=$'\t' read -r sid slabel surls; do
    src_ids+=("${sid}")
    src_labels+=("${slabel}")
    src_urls_arr+=("${surls}")
  done <<< "${source_data}"

  # En modo troubleshooting: filtra solo BC Gov
  if [[ "${TROUBLESHOOTING}" == "on" ]]; then
    local -a ts_ids=() ts_labels=() ts_urls=()
    for i in "${!src_ids[@]}"; do
      if [[ "${src_ids[$i]}" == "bc_gov" ]]; then
        ts_ids+=("${src_ids[$i]}")
        ts_labels+=("${src_labels[$i]}")
        ts_urls+=("${src_urls_arr[$i]}")
      fi
    done
    src_ids=("${ts_ids[@]}")
    src_labels=("${ts_labels[@]}")
    src_urls_arr=("${ts_urls[@]}")
    echo ""
    echo "  🔧 TROUBLESHOOTING MODE — solo BC Gov, manager, últimos 7 días"
    log_step 5 "TROUBLESHOOTING MODE activo" "${log_file}"
  fi

  local total_sources="${#src_ids[@]}"
  local -a all_normalized=()

  for (( idx=0; idx<total_sources; idx++ )); do
    local src_id="${src_ids[$idx]}"
    local src_label="${src_labels[$idx]}"
    local src_urls="${src_urls_arr[$idx]//|/$'\n'}"
    local pos=$(( idx + 1 ))
    local pct=$(( 10 + idx * 70 / total_sources ))

    # ── Pre-flight: no iniciar si ya estamos en el límite ─────────────────────
    if [[ "${idx}" -gt 0 && "${cumulative_tokens}" -ge "${TOKEN_LIMIT}" ]]; then
      log_step "${pct}" "⚠️  Token limit — saltando ${src_label} y siguientes" "${log_file}"
      echo "  ⚠️  Token limit ${TOKEN_LIMIT} alcanzado (${cumulative_tokens}). Saltando ${src_label}."
      break
    fi

    log_step "${pct}" "[${pos}/${total_sources}] ${src_label}" "${log_file}"
    echo ""
    echo "  ━━━ [${pos}/${total_sources}] ${src_label} ━━━"

    # Prompt: mínimo en troubleshooting, enfocado por fuente en modo normal
    local tmp_prompt="${run_dir}/prompt-${src_id}.md"
    if [[ "${TROUBLESHOOTING}" == "on" ]]; then
      build_troubleshooting_prompt > "${tmp_prompt}"
    else
      build_source_prompt "${prompt_abs}" "${src_label}" "${src_urls}" > "${tmp_prompt}"
    fi

    # Archivos de esta fuente
    local raw_file="${run_dir}/raw-${src_id}.txt"
    local tokens_file="${run_dir}/tokens-${src_id}.json"
    local jsonl_file="${run_dir}/events-${src_id}.jsonl"

    # Ejecuta Codex
    "${CODEX_BIN}" --search -a never exec \
      --sandbox workspace-write \
      --json \
      -C "${REPO_ROOT}" \
      -m "${MODEL}" \
      - < "${tmp_prompt}" \
      | tee "${jsonl_file}" \
      | "${PYTHON_BIN}" "${monitor}" "${raw_file}" "${tokens_file}" \
      || true

    # Lee tokens de esta fuente
    local src_tokens=0
    if [[ -f "${tokens_file}" ]]; then
      src_tokens="$("${PYTHON_BIN}" -c \
        "import json; d=json.load(open('${tokens_file}')); print(d.get('total',0))" \
        2>/dev/null || echo 0)"
    fi
    cumulative_tokens=$(( cumulative_tokens + src_tokens ))

    printf "  📊 Tokens fuente: %s | Acumulado: %s/%s\n" \
      "${src_tokens}" "${cumulative_tokens}" "${TOKEN_LIMIT}"

    # Normaliza y agrega tabla si hay resultados
    if [[ -f "${raw_file}" && -s "${raw_file}" ]]; then
      local normalized_json="${run_dir}/normalized-${src_id}.json"

      "${PYTHON_BIN}" "${exporter}" \
        --input "${raw_file}" \
        --output "${normalized_json}" \
        --batch-name "${BATCH_NAME}" \
        --prompt-file "${prompt_abs}" \
        --raw-output-file "${raw_file}" \
        --dry-run \
        2>/dev/null || true

      if [[ -f "${normalized_json}" ]]; then
        local src_count
        src_count="$("${PYTHON_BIN}" -c \
          "import json; d=json.load(open('${normalized_json}')); print(d.get('count',0))" \
          2>/dev/null || echo 0)"

        if [[ "${src_count}" -gt 0 ]]; then
          append_source_table "${progressive_md}" "${src_label}" "${normalized_json}"
          all_normalized+=("${normalized_json}")
          total_offers=$(( total_offers + src_count ))
          log_step "" "${src_label} — ${src_count} ofertas ✅" "${log_file}"
          echo "  ✅ ${src_count} ofertas encontradas"
        else
          log_step "" "${src_label} — sin resultados" "${log_file}"
          echo "  ⬜ Sin resultados"
        fi
      fi
    else
      log_step "" "${src_label} — sin output" "${log_file}"
      echo "  ⬜ Sin output de Codex"
    fi

    # Para si se alcanzó el límite de tokens
    if [[ "${cumulative_tokens}" -ge "${TOKEN_LIMIT}" ]]; then
      log_step 85 "⚠️  Token limit ${TOKEN_LIMIT} alcanzado (${cumulative_tokens}) — deteniendo" "${log_file}"
      echo ""
      echo "  ⚠️  Límite de tokens alcanzado (${cumulative_tokens}/${TOKEN_LIMIT}). Deteniendo búsqueda."
      break
    fi

    # Espera entre fuentes (no después de la última)
    if [[ $(( idx + 1 )) -lt "${total_sources}" ]]; then
      sleep_with_countdown "${SOURCE_SLEEP_SECONDS}" "${src_label}"
    fi
  done

  # ── Agrega y envía a n8n ────────────────────────────────────────────────────
  log_step 90 "Agregando ${total_offers} ofertas para n8n..." "${log_file}"

  if [[ "${#all_normalized[@]}" -gt 0 ]]; then
    local final_json="${run_dir}/joboffers-normalized.json"

    NORM_FILES="${all_normalized[*]}" \
    BATCH_NAME="${BATCH_NAME}" \
    PROMPT_ABS="${prompt_abs}" \
    RUN_DIR="${run_dir}" \
    FINAL_JSON="${final_json}" \
    N8N_WEBHOOK_URL="${N8N_WEBHOOK_URL:-}" \
    "${PYTHON_BIN}" - <<'PYEOF'
import json, os, datetime as dt, urllib.request, urllib.error, sys
from pathlib import Path

files       = os.environ["NORM_FILES"].split()
batch_name  = os.environ["BATCH_NAME"]
prompt_abs  = os.environ["PROMPT_ABS"]
final_json  = os.environ["FINAL_JSON"]
webhook_url = os.environ.get("N8N_WEBHOOK_URL", "").strip()

all_rows, columns = [], None
for f in files:
    try:
        d = json.loads(Path(f).read_text(encoding="utf-8"))
        if not columns:
            columns = d.get("columns", [])
        all_rows.extend(d.get("rows", []))
    except Exception as e:
        print(f"  [merge] Warning: {f}: {e}", file=sys.stderr)

payload = {
    "columns": columns or [],
    "rows": all_rows,
    "count": len(all_rows),
    "batch_name": batch_name,
    "prompt_file": prompt_abs,
    "raw_output_file": os.environ["RUN_DIR"],
    "exported_at": dt.datetime.now(dt.timezone.utc).isoformat(),
}
Path(final_json).write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
print(f"  [merge] {len(all_rows)} ofertas de {len(files)} fuentes → {final_json}")

if not webhook_url:
    print(json.dumps({"posted": False, "reason": "N8N_WEBHOOK_URL not set", "count": len(all_rows)}))
    sys.exit(0)

try:
    data = json.dumps(payload).encode("utf-8")
    req  = urllib.request.Request(
        webhook_url, data=data,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        print(json.dumps({"posted": True, "status": resp.status, "count": len(all_rows)}))
except urllib.error.URLError as exc:
    print(json.dumps({"posted": False, "error": str(exc)}), file=sys.stderr)
    sys.exit(1)
PYEOF
  fi

  log_step 100 "Completado — ${total_offers} ofertas | tokens: ${cumulative_tokens}/${TOKEN_LIMIT}" "${log_file}"
  echo "" >> "${log_file}"
  echo "**Fin:** $(date '+%Y-%m-%d %H:%M:%S') | **Ofertas:** ${total_offers} | **Tokens:** ${cumulative_tokens}" >> "${log_file}"

  echo ""
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Listo — ${total_offers} ofertas | tokens: ${cumulative_tokens}/${TOKEN_LIMIT}"
  echo "  MD:  ${progressive_md}"
  echo "  Log: ${log_file}"
}

main() {
  load_env_file
  validate_config
  require_cmd "${CODEX_BIN}"
  require_cmd "${PYTHON_BIN}"

  if [[ "${MODE}" == "once" ]]; then
    run_all_sources
    exit 0
  fi

  while true; do
    if is_in_window; then
      run_all_sources
      sleep "$((INTERVAL_MINUTES * 60))"
    else
      local wait_seconds
      wait_seconds="$(seconds_until_window_start)"
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Outside window, sleeping ${wait_seconds}s"
      sleep "${wait_seconds}"
    fi
  done
}

main "$@"
