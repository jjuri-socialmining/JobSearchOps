#!/usr/bin/env python3

import argparse
from pathlib import Path


def parse_table(lines):
    header_index = None
    header = None
    rows = []

    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        cols = [c.strip() for c in stripped.split("|")[1:-1]]
        normalized = [c.lower() for c in cols]
        if "nombre del script" in normalized:
            header_index = index
            header = cols
            continue
        if header is None:
            continue
        if index == header_index + 1:
            continue
        if len(cols) != len(header):
            continue
        rows.append((index, cols))

    return header_index, header, rows


def find_row(rows, script_path):
    for index, cols in rows:
        if script_path in cols[0]:
            return index, cols
    return None, None


def write_row(lines, row_index, header, row):
    widths = [len(item) for item in header]
    rendered = "| " + " | ".join(row[i].ljust(widths[i]) for i in range(len(header))) + " |\n"
    lines[row_index] = rendered


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["get", "update"])
    parser.add_argument("--table", required=True)
    parser.add_argument("--script", required=True)
    parser.add_argument("--field")
    parser.add_argument("--set", action="append", default=[])
    args = parser.parse_args()

    table_path = Path(args.table)
    lines = table_path.read_text(encoding="utf-8").splitlines(keepends=True)
    _, header, rows = parse_table(lines)
    if not header:
        raise SystemExit("table header not found")

    row_index, row = find_row(rows, args.script)
    if row is None:
        raise SystemExit("script row not found")

    normalized_header = [item.lower() for item in header]

    if args.command == "get":
        if not args.field:
            raise SystemExit("--field is required for get")
        try:
            idx = normalized_header.index(args.field.lower())
        except ValueError as exc:
            raise SystemExit(f"field not found: {args.field}") from exc
        print(row[idx].strip().strip("`"))
        return

    updates = {}
    for item in args.set:
        if "=" not in item:
            raise SystemExit(f"invalid --set value: {item}")
        key, value = item.split("=", 1)
        updates[key.strip().lower()] = value.strip()

    if not updates:
        raise SystemExit("at least one --set is required")

    row_copy = list(row)
    for key, value in updates.items():
        try:
            idx = normalized_header.index(key)
        except ValueError as exc:
            raise SystemExit(f"field not found: {key}") from exc
        row_copy[idx] = value

    write_row(lines, row_index, header, row_copy)
    table_path.write_text("".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
