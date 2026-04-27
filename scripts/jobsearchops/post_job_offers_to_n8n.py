#!/usr/bin/env python3
"""Normalize job offers into the JobOffers column format and post to n8n."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Iterable


COLUMNS = [
    "Version",
    "Schema Version",
    "Alias",
    "Date",
    "Posted",
    "Industry",
    "N Applicants",
    "Ranking",
    "Prioridad",
    "Veredicto",
    "Organización",
    "Título",
    "Ubicación / Modalidad",
    "Compensación",
    "Por qué mirar esto primero",
    "Qué te falta validar antes de invertir tiempo",
    "Link",
]

FIELD_ALIASES = {
    "Version": ["Version", "version"],
    "Schema Version": ["Schema Version", "schema_version", "schemaVersion"],
    "Alias": ["Alias", "alias"],
    "Date": ["Date", "date", "fecha"],
    "Posted": ["Posted", "posted", "publicado", "fecha_publicacion", "posted_date"],
    "Industry": ["Industry", "industry", "industria"],
    "N Applicants": ["N Applicants", "n_applicants", "applicants", "nApplicants"],
    "Ranking": ["Ranking", "ranking", "score", "puntaje"],
    "Prioridad": ["Prioridad", "prioridad", "priority"],
    "Veredicto": ["Veredicto", "veredicto", "verdict"],
    "Organización": ["Organización", "Organizacion", "organizacion", "organization", "company", "employer"],
    "Título": ["Título", "Titulo", "titulo", "title", "job_title", "role"],
    "Ubicación / Modalidad": [
        "Ubicación / Modalidad",
        "Ubicacion / Modalidad",
        "ubicacion_modalidad",
        "location_mode",
        "location",
        "modalidad",
    ],
    "Compensación": ["Compensación", "Compensacion", "compensacion", "salary", "compensation"],
    "Por qué mirar esto primero": [
        "Por qué mirar esto primero",
        "Por que mirar esto primero",
        "por_que_mirar_esto_primero",
        "why_first",
        "why_it_matters",
    ],
    "Qué te falta validar antes de invertir tiempo": [
        "Qué te falta validar antes de invertir tiempo",
        "Que te falta validar antes de invertir tiempo",
        "que_falta_validar",
        "missing_validation",
        "open_questions",
    ],
    "Link": ["Link", "link", "url", "job_url"],
}

LIST_CONTAINER_KEYS = ("offers", "jobs", "results", "items", "rows", "data", "job_offers")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Raw Codex output or JSON file.")
    parser.add_argument("--output", help="Where to write normalized JSON.")
    parser.add_argument("--batch-name", default=os.environ.get("BATCH_NAME", "jobsearchops"))
    parser.add_argument("--prompt-file", default=os.environ.get("PROMPT_FILE", ""))
    parser.add_argument("--raw-output-file", default=os.environ.get("RAW_OUTPUT_FILE", ""))
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def read_text(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def try_parse_json_blob(text: str) -> Any:
    stripped = text.strip()
    if not stripped:
        raise ValueError("Input is empty.")
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    fenced_match = re.search(r"```json\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if fenced_match:
        return json.loads(fenced_match.group(1).strip())

    decoder = json.JSONDecoder()
    for index, char in enumerate(text):
        if char not in "[{":
            continue
        try:
            payload, _ = decoder.raw_decode(text[index:])
            return payload
        except json.JSONDecodeError:
            continue
    raise ValueError("No JSON payload found in input.")


def extract_records(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in LIST_CONTAINER_KEYS:
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        return [payload]
    raise ValueError("Unsupported payload type.")


def first_value(record: dict[str, Any], aliases: Iterable[str]) -> Any:
    for key in aliases:
        if key in record and record[key] not in (None, ""):
            return record[key]
    return ""


def stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return "; ".join(stringify(item) for item in value if stringify(item))
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=True, sort_keys=True)
    return str(value).strip()


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.lower()).strip("-")
    return normalized[:120]


def build_alias(row: dict[str, str]) -> str:
    alias = row["Alias"]
    if alias:
        return slugify(alias)
    parts = [row["Organización"], row["Título"], row["Date"]]
    return slugify("-".join(part for part in parts if part)) or "job-offer"


# URLs de búsqueda/lista — NO son links directos a una oferta
# indeed.com/jobs? es search; indeed.com/viewjob?jk=HEXID sí es directo
_SEARCH_PAGE_PATTERNS = re.compile(
    r"(linkedin\.com/jobs/search|linkedin\.com/search|"
    r"glassdoor\.com/Job/jobs|monster\.com/jobs/search|ziprecruiter\.com/jobs|"
    r"workopolis\.com/resultat|jobbank\.gc\.ca/jobsearch)",
    re.IGNORECASE,
)

# jk= con texto descriptivo (no ID): detecta + o espacios en el valor
_INDEED_INVALID_JK = re.compile(r"indeed\.com/viewjob\?jk=[^&]*[+%20 ][^&]*", re.IGNORECASE)

# ID válido de Indeed: solo alfanumérico, 8-20 chars
_INDEED_VALID_JK = re.compile(r"indeed\.com/viewjob\?jk=([a-z0-9]{8,20})", re.IGNORECASE)

# Extrae vjk de URLs de búsqueda de Indeed (indeed.com/jobs?...vjk=ID)
_INDEED_VJK = re.compile(r"[?&]vjk=([a-z0-9]{8,20})", re.IGNORECASE)

_LINK_CHECK_TIMEOUT = 8  # segundos


_CLOSED_PHRASES = re.compile(
    r"no longer accepting|no longer available|position (has been )?filled|"
    r"job has expired|this posting has closed|application closed|"
    r"posting is closed|expired|ya no acepta",
    re.IGNORECASE,
)

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def _fetch_page_sample(url: str, max_bytes: int = 8192) -> str:
    """GET los primeros max_bytes de la página. Devuelve string vacío si falla."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": _UA})
        with urllib.request.urlopen(req, timeout=_LINK_CHECK_TIMEOUT) as resp:
            return resp.read(max_bytes).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _url_resolves(url: str) -> bool:
    """HEAD request para verificar que la URL existe y no devuelve 404."""
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": _UA})
        with urllib.request.urlopen(req, timeout=_LINK_CHECK_TIMEOUT) as resp:
            return getattr(resp, "status", 200) < 400
    except urllib.error.HTTPError as exc:
        if exc.code == 405:
            return bool(_fetch_page_sample(url, 512))
        return exc.code < 400
    except Exception:
        return False


def _job_is_closed(url: str) -> bool:
    """Devuelve True si la página indica que la oferta ya no acepta postulaciones."""
    sample = _fetch_page_sample(url)
    if not sample:
        return False
    return bool(_CLOSED_PHRASES.search(sample))


def _normalize_indeed_url(url: str) -> str:
    """
    Convierte una URL de búsqueda de Indeed con vjk= a viewjob directo.
    Si ya es viewjob con ID válido, la retorna tal cual.
    """
    # Ya es viewjob con ID válido
    if _INDEED_VALID_JK.search(url):
        return url
    # indeed.com/jobs?...vjk=ID  →  indeed.com/viewjob?jk=ID
    vjk_match = _INDEED_VJK.search(url)
    if vjk_match:
        job_id = vjk_match.group(1)
        normalized = f"https://ca.indeed.com/viewjob?jk={job_id}"
        print(f"  [schema] Indeed URL normalizada: {job_id}", file=sys.stderr)
        return normalized
    return url


def validate_link(url: str) -> str:
    """Normaliza, valida patrón, verifica que existe y que la oferta sigue activa."""
    if not url:
        return ""
    if not url.startswith("http"):
        return ""

    # Intenta rescatar job ID de Indeed antes de descartar
    if "indeed.com" in url.lower():
        url = _normalize_indeed_url(url)
        # Si después de normalizar sigue siendo inválido (jk con texto), descarta
        if _INDEED_INVALID_JK.search(url):
            print(f"  [schema] Link descartado (Indeed jk inválido): {url[:80]}", file=sys.stderr)
            return ""
        # Si sigue siendo URL de búsqueda sin vjk, descarta
        if "indeed.com/jobs?" in url.lower() or "indeed.com/q-" in url.lower():
            print(f"  [schema] Link descartado (Indeed search page): {url[:80]}", file=sys.stderr)
            return ""

    if _SEARCH_PAGE_PATTERNS.search(url):
        print(f"  [schema] Link descartado (página de búsqueda): {url[:80]}", file=sys.stderr)
        return ""
    if not _url_resolves(url):
        print(f"  [schema] Link descartado (página no existe): {url[:80]}", file=sys.stderr)
        return ""
    if _job_is_closed(url):
        print(f"  [schema] Link descartado (oferta cerrada): {url[:80]}", file=sys.stderr)
        return ""
    return url


def normalize_record(record: dict[str, Any]) -> dict[str, str]:
    today = dt.date.today().isoformat()
    normalized: dict[str, str] = {}
    for column in COLUMNS:
        normalized[column] = stringify(first_value(record, FIELD_ALIASES[column]))

    normalized["Version"] = normalized["Version"] or "1"
    normalized["Schema Version"] = normalized["Schema Version"] or "joboffers.v1"
    normalized["Date"] = normalized["Date"] or today
    normalized["Alias"] = build_alias(normalized)
    normalized["Link"] = validate_link(normalized["Link"])
    return normalized


def build_payload(rows: list[dict[str, str]], args: argparse.Namespace) -> dict[str, Any]:
    return {
        "columns": COLUMNS,
        "rows": rows,
        "count": len(rows),
        "batch_name": args.batch_name,
        "prompt_file": args.prompt_file,
        "raw_output_file": args.raw_output_file,
        "exported_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


def build_markdown_table(rows: list[dict[str, str]]) -> str:
    header = "| " + " | ".join(COLUMNS) + " |"
    separator = "| " + " | ".join(["---"] * len(COLUMNS)) + " |"
    body = []
    for row in rows:
        escaped = [row[column].replace("|", "\\|").replace("\n", " ") for column in COLUMNS]
        body.append("| " + " | ".join(escaped) + " |")
    return "\n".join([header, separator, *body]) + "\n"


def post_payload(webhook_url: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read().decode("utf-8", errors="replace")
        return {
            "status_code": getattr(response, "status", None),
            "response_body": body,
        }


def main() -> int:
    args = parse_args()
    text = read_text(args.input)
    payload = try_parse_json_blob(text)
    all_rows = [normalize_record(record) for record in extract_records(payload)]
    rows = [r for r in all_rows if r.get("Link")]
    discarded = len(all_rows) - len(rows)
    if discarded:
        print(f"  [schema] {discarded} oferta(s) excluida(s) por Link vacío o inválido", file=sys.stderr)
    export_payload = build_payload(rows, args)

    if args.output:
        Path(args.output).write_text(
            json.dumps(export_payload, ensure_ascii=True, indent=2) + "\n",
            encoding="utf-8",
        )
        markdown_path = str(Path(args.output).with_suffix(".md"))
        Path(markdown_path).write_text(build_markdown_table(rows), encoding="utf-8")

    webhook_url = os.environ.get("N8N_WEBHOOK_URL", "").strip()
    if webhook_url and not args.dry_run:
        try:
            result = post_payload(webhook_url, export_payload)
            print(json.dumps({"posted": True, **result}, ensure_ascii=True))
        except urllib.error.URLError as exc:
            print(json.dumps({"posted": False, "error": str(exc)}, ensure_ascii=True), file=sys.stderr)
            return 1
    else:
        print(
            json.dumps(
                {
                    "posted": False,
                    "reason": "N8N_WEBHOOK_URL not set" if not webhook_url else "dry-run",
                    "count": len(rows),
                },
                ensure_ascii=True,
            )
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
