#!/usr/bin/env python3
"""
Lee JSONL de codex --json desde stdin y muestra progreso legible en consola.
Extrae el último mensaje del asistente y lo escribe en output_file (arg1).
Muestra estado de sources definidos en automation/sources/jobsearchops-sources.json.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

# Archivo donde escribir el último mensaje (arg1) y tokens (arg2)
_OUTPUT_FILE = Path(sys.argv[1]) if len(sys.argv) > 1 else None
_TOKENS_FILE = Path(sys.argv[2]) if len(sys.argv) > 2 else None

# ── Colores ────────────────────────────────────────────────────────────────────
BOLD   = "\033[1m"
CYAN   = "\033[36m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
GRAY   = "\033[90m"
DIM    = "\033[2m"
RESET  = "\033[0m"

# ── Carga sources ──────────────────────────────────────────────────────────────
_SCRIPT_DIR  = Path(__file__).parent
_SOURCES_FILE = _SCRIPT_DIR.parent.parent / "automation" / "sources" / "jobsearchops-sources.json"

def _load_sources() -> list[dict]:
    try:
        data = json.loads(_SOURCES_FILE.read_text(encoding="utf-8"))
        return data.get("sources", [])
    except Exception:
        return []

SOURCES = _load_sources()

# Estado por source: None = pendiente, "searching" = buscando, "hit" = encontrado
source_status: dict[str, str] = {s["id"]: "pending" for s in SOURCES}

def _detect_source(text: str) -> str | None:
    """Devuelve el id del source si el texto coincide con algún patrón."""
    text_lower = text.lower()
    for src in SOURCES:
        for pattern in src.get("url_patterns", []):
            if pattern.lower() in text_lower:
                return src["id"]
        for hint in src.get("search_hints", []):
            # Busca palabras clave del hint en el texto
            words = [w.lower() for w in re.split(r"\W+", hint) if len(w) > 4]
            if words and sum(1 for w in words if w in text_lower) >= max(1, len(words) // 2):
                return src["id"]
    return None

def _render_sources_panel() -> None:
    """Imprime el panel de sources con estado actual."""
    sys.stderr.write(f"\n{BOLD}  Sources:{RESET}\n")
    for src in SOURCES:
        sid    = src["id"]
        label  = src["label"]
        mode   = src.get("mode", "")
        status = source_status[sid]
        if status == "hit":
            icon = f"{GREEN}✅{RESET}"
        elif status == "searching":
            icon = f"{YELLOW}🔄{RESET}"
        else:
            icon = f"{GRAY}⬜{RESET}"
        suffix = f" {DIM}(overlay){RESET}" if mode == "overlay" else ""
        sys.stderr.write(f"    {icon} {label}{suffix}\n")
    sys.stderr.flush()

def fmt_tokens(n: int) -> str:
    return f"{n:,}" if n >= 1000 else str(n)

def short(text: str, max_len: int = 90) -> str:
    text = str(text).replace("\n", " ").strip()
    return text[:max_len] + "…" if len(text) > max_len else text

# ── Estado global ──────────────────────────────────────────────────────────────
search_count = 0
tool_count   = 0
tokens_in    = 0
tokens_out   = 0
start_time   = time.time()

def elapsed() -> str:
    s = int(time.time() - start_time)
    return f"{s//60}m{s%60:02d}s"

# ── Render inicial del panel ───────────────────────────────────────────────────
sys.stderr.write(f"\n{BOLD}{'─'*60}{RESET}\n")
sys.stderr.write(f"{BOLD}  JobSearchOps — Monitor de búsqueda{RESET}\n")
sys.stderr.write(f"{BOLD}{'─'*60}{RESET}\n")
_render_sources_panel()
sys.stderr.write(f"{BOLD}{'─'*60}{RESET}\n\n")
sys.stderr.flush()

# ── Loop principal ─────────────────────────────────────────────────────────────
last_message: str = ""

for raw_line in sys.stdin:
    sys.stdout.write(raw_line)
    sys.stdout.flush()

    line = raw_line.strip()
    if not line:
        continue

    try:
        event = json.loads(line)
    except json.JSONDecodeError:
        continue

    etype = event.get("type", "")

    # ── Desenvuelve eventos item.started / item.completed de Codex CLI ─────────
    if etype in ("item.started", "item.completed"):
        item = event.get("item", {})
        itype = item.get("type", "")

        if itype == "web_search":
            action  = item.get("action", {})
            query   = action.get("query") or action.get("queries", [""])[0] if action.get("queries") else action.get("query", "")
            if not query:
                continue
            search_count += 1
            tool_count   += 1
            full_text = f"web_search {query}"
            sid = _detect_source(full_text)
            if sid:
                source_status[sid] = "hit" if etype == "item.completed" else "searching"
                label = next(s["label"] for s in SOURCES if s["id"] == sid)
                if etype == "item.completed":
                    sys.stderr.write(f"{GREEN}  ✅ {label} — resultados encontrados{RESET}\n")
                    _render_sources_panel()
            src_label = f" {CYAN}[{next((s['label'] for s in SOURCES if s['id']==sid), '')}]{RESET}" if sid else ""
            sys.stderr.write(f"{BOLD}{CYAN}🔍 [{search_count}]{RESET}{src_label} {short(query)}\n")
            sys.stderr.flush()

        elif itype == "agent_message" and etype == "item.completed":
            text = item.get("text", "")
            if text.strip():
                last_message = text
                sys.stderr.write(f"{GREEN}  💬 {short(text)}{RESET}\n")
                sys.stderr.flush()
        continue

    # ── Tool call (búsqueda web u otra herramienta) ────────────────────────────
    if etype in ("function_call", "tool_call"):
        name = event.get("name") or event.get("function", {}).get("name", "")
        args = event.get("arguments") or event.get("input") or {}
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except Exception:
                args = {}
        tool_count += 1

        query = args.get("query") or args.get("q") or args.get("url") or str(args)
        full_text = f"{name} {query}"

        sid = _detect_source(full_text)
        if sid and source_status[sid] == "pending":
            source_status[sid] = "searching"

        if "search" in name.lower() or "web" in name.lower() or "browse" in name.lower():
            search_count += 1
            src_label = ""
            if sid:
                src_label = f" {CYAN}[{next(s['label'] for s in SOURCES if s['id']==sid)}]{RESET}"
            sys.stderr.write(
                f"{BOLD}{CYAN}🔍 [{search_count}]{RESET}{src_label} {short(query)}\n"
            )
        else:
            sys.stderr.write(f"{GRAY}  → {name}: {short(query, 70)}{RESET}\n")
        sys.stderr.flush()

    # ── Resultado de herramienta ───────────────────────────────────────────────
    elif etype in ("function_call_output", "tool_result"):
        output = event.get("output") or event.get("content") or ""
        if isinstance(output, list):
            output = " ".join(
                (c.get("text") or c.get("content") or "") if isinstance(c, dict) else str(c)
                for c in output
            )
        output_str = str(output)

        # Detecta qué source produjo resultados
        sid = _detect_source(output_str)
        if sid and source_status[sid] in ("pending", "searching"):
            source_status[sid] = "hit"
            label = next(s["label"] for s in SOURCES if s["id"] == sid)
            sys.stderr.write(f"{GREEN}  ✅ {label} — resultados encontrados{RESET}\n")
            _render_sources_panel()

        snippet = short(output_str, 100)
        sys.stderr.write(f"{GRAY}     ↳ {snippet}{RESET}\n")
        sys.stderr.flush()

    # ── Mensaje del asistente ─────────────────────────────────────────────────
    elif etype in ("assistant_message", "message"):
        content = event.get("content") or ""
        if isinstance(content, list):
            content = " ".join(
                (c.get("text") or "") if isinstance(c, dict) else str(c)
                for c in content
            )
        if content.strip():
            last_message = content  # guarda el último para escribir al archivo
            sys.stderr.write(f"{GREEN}  💬 {short(content)}{RESET}\n")
            sys.stderr.flush()

    # ── Razonamiento ──────────────────────────────────────────────────────────
    elif etype == "reasoning":
        text = event.get("content") or event.get("text") or ""
        if isinstance(text, list):
            text = " ".join(t.get("text","") if isinstance(t,dict) else str(t) for t in text)
        if text.strip():
            sys.stderr.write(f"{YELLOW}  🧠 {short(text)}{RESET}\n")
            sys.stderr.flush()

    # ── Tokens ────────────────────────────────────────────────────────────────
    elif etype in ("usage", "token_usage", "response.completed", "response.done", "turn.completed"):
        usage = (
            event.get("usage")
            or event.get("token_usage")
            or event.get("response", {}).get("usage")
            or event
        )
        if isinstance(usage, dict):
            tokens_in  = usage.get("input_tokens",  usage.get("prompt_tokens",     tokens_in))
            tokens_out = usage.get("output_tokens", usage.get("completion_tokens", tokens_out))
        total = tokens_in + tokens_out
        sys.stderr.write(
            f"\n{BOLD}📊 Tokens — entrada:{fmt_tokens(tokens_in)}  "
            f"salida:{fmt_tokens(tokens_out)}  "
            f"total:{fmt_tokens(total)}{RESET}\n"
        )
        sys.stderr.flush()

# ── Escribe último mensaje al archivo de salida ───────────────────────────────
if _OUTPUT_FILE and last_message:
    _OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    _OUTPUT_FILE.write_text(last_message, encoding="utf-8")
    sys.stderr.write(f"{GREEN}  💾 Respuesta guardada: {_OUTPUT_FILE}{RESET}\n")
elif _OUTPUT_FILE:
    sys.stderr.write(f"{YELLOW}  ⚠️  Sin mensaje final para guardar en {_OUTPUT_FILE}{RESET}\n")

# ── Escribe tokens al sidecar ─────────────────────────────────────────────────
if _TOKENS_FILE:
    _TOKENS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _TOKENS_FILE.write_text(
        json.dumps({"input_tokens": tokens_in, "output_tokens": tokens_out, "total": tokens_in + tokens_out}),
        encoding="utf-8",
    )

# ── Resumen final ──────────────────────────────────────────────────────────────
total = tokens_in + tokens_out
sys.stderr.write(f"\n{BOLD}{'─'*60}{RESET}\n")
sys.stderr.write(f"{BOLD}✅ Codex terminó — {elapsed()}{RESET}\n")
_render_sources_panel()
sys.stderr.write(f"\n   🔍 Búsquedas : {search_count}  |  🔧 Herramientas : {tool_count}\n")
if total:
    sys.stderr.write(
        f"   📊 Tokens  entrada:{fmt_tokens(tokens_in)}  "
        f"salida:{fmt_tokens(tokens_out)}  "
        f"total:{fmt_tokens(total)}\n"
    )
else:
    sys.stderr.write("   📊 Tokens   : no reportados por este modelo/plan\n")
sys.stderr.write(f"{BOLD}{'─'*60}{RESET}\n\n")
sys.stderr.flush()
