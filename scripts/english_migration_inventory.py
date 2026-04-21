#!/usr/bin/env python3
"""Inventory Spanish/runtime contracts before the DOA English migration.

This script is deterministic and read-only. It scans text files in the app,
counts known Spanish terms, extracts Supabase `.from(...)` references, and
records files likely to need manual review.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable

TEXT_SUFFIXES = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".md", ".mdx", ".sql", ".css", ".html", ".txt",
}
SKIP_DIRS = {
    ".git", ".next", "node_modules", ".npm-cache", ".turbo", "dist", "build",
    ".vercel", "coverage", ".cache", "__pycache__", "rag-backend",
}
SPANISH_TERMS = [
    "proyecto", "proyectos", "historico", "histórico", "consulta", "consultas",
    "cliente", "clientes", "aeronave", "aeronaves", "modelo", "fabricante",
    "estado", "estados", "descripcion", "descripción", "formulario", "formularios",
    "respuesta", "respuestas", "correo", "correos", "asunto", "remitente",
    "clasificacion", "clasificación", "validacion", "validación", "entrega",
    "entregado", "enviado", "enviada", "enviar", "cerrar", "archivar",
    "usuario", "usuarios", "plantilla", "plantillas", "aprobacion", "aprobación",
    "oferta", "ofertas", "documento", "documentos", "fecha", "fechas",
    "inicio", "fin", "prioridad", "notas", "ruta", "carpeta", "familia",
    "pais", "país", "ciudad", "direccion", "dirección", "telefono", "teléfono",
    "nombre", "apellidos", "cargo", "activo", "principal", "entrada",
]
FROM_RE = re.compile(r"\.from\(\s*(['\"])([^'\"]+)\1\s*\)")
ROUTE_SEGMENT_RE = re.compile(r"(?<![A-Za-z0-9_])/(proyectos-historico|proyectos|consultas|aeronaves|clientes|bases-de-datos|herramientas)(?=/?[\"'`\s),])")

SCAN_DIRS = [
    "app", "components", "lib", "types", "store", "supabase", "docs", "Formularios",
    "scripts", "tools", "openspec", "01. Soporte_App",
]
MAX_TEXT_BYTES = 2_000_000


def iter_files(root: Path) -> Iterable[Path]:
    roots = [root / name for name in SCAN_DIRS if (root / name).exists()]
    # Include selected root-level project files without traversing every folder.
    roots += [path for path in root.iterdir() if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES]
    for scan_root in roots:
        iterator = [scan_root] if scan_root.is_file() else sorted(scan_root.rglob("*"))
        for path in iterator:
            if not path.is_file():
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            try:
                if path.stat().st_size > MAX_TEXT_BYTES:
                    continue
            except OSError:
                continue
            yield path


def read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", required=True, help="Path to the app root")
    parser.add_argument("--output", required=True, help="Output JSON path")
    args = parser.parse_args()

    app_root = Path(args.app).resolve()
    output = Path(args.output).resolve()
    if not app_root.exists():
        raise SystemExit(f"App path does not exist: {app_root}")

    term_counts: Counter[str] = Counter()
    term_files: dict[str, Counter[str]] = defaultdict(Counter)
    table_counts: Counter[str] = Counter()
    table_files: dict[str, list[str]] = defaultdict(list)
    route_counts: Counter[str] = Counter()
    route_files: dict[str, list[str]] = defaultdict(list)
    spanish_files: Counter[str] = Counter()
    total_files = 0

    term_res = {term: re.compile(rf"(?i)(?<![A-Za-zÀ-ÿ_]){re.escape(term)}(?![A-Za-zÀ-ÿ_])") for term in SPANISH_TERMS}

    for path in iter_files(app_root):
        text = read_text(path)
        if text is None:
            continue
        total_files += 1
        rel = str(path.relative_to(app_root))

        file_score = 0
        for term, rx in term_res.items():
            count = len(rx.findall(text))
            if count:
                term_counts[term] += count
                term_files[term][rel] += count
                file_score += count
        if file_score:
            spanish_files[rel] = file_score

        for _, table in FROM_RE.findall(text):
            table_counts[table] += 1
            if rel not in table_files[table]:
                table_files[table].append(rel)

        for match in ROUTE_SEGMENT_RE.findall(text):
            route = f"/{match}"
            route_counts[route] += 1
            if rel not in route_files[route]:
                route_files[route].append(rel)

    payload = {
        "app_root": str(app_root),
        "total_text_files_scanned": total_files,
        "spanish_term_counts": dict(term_counts.most_common()),
        "top_spanish_files": dict(spanish_files.most_common(80)),
        "supabase_from_counts": dict(table_counts.most_common()),
        "supabase_from_files": {k: sorted(v) for k, v in sorted(table_files.items())},
        "route_counts": dict(route_counts.most_common()),
        "route_files": {k: sorted(v) for k, v in sorted(route_files.items())},
        "term_top_files": {
            term: dict(counter.most_common(20)) for term, counter in sorted(term_files.items())
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(output),
        "files_scanned": total_files,
        "spanish_terms": sum(term_counts.values()),
        "supabase_tables": len(table_counts),
        "routes": len(route_counts),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
