"""
Cache para resultados de OCR de Mistral.
Guarda el resultado en disco para no repetir llamadas costosas a la API.
"""

import os
import json
import hashlib
import gzip
from pathlib import Path
from typing import Optional
from dataclasses import asdict

from core.ocr_processor import OCRResult, OCRPage, OCRImage


# Carpeta donde se guardan los caches
CACHE_DIR = Path(__file__).parent.parent / "ocr_cache"


def _get_file_hash(file_path: str) -> str:
    """Calcula el hash MD5 de un archivo PDF."""
    md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            md5.update(chunk)
    return md5.hexdigest()


def _cache_path(file_hash: str) -> Path:
    """Devuelve la ruta del archivo de caché para un hash dado."""
    CACHE_DIR.mkdir(exist_ok=True)
    return CACHE_DIR / f"{file_hash}.json.gz"


def get_cached_ocr(file_path: str) -> Optional[OCRResult]:
    """
    Busca el resultado OCR en caché para un archivo dado.

    Returns:
        OCRResult si existe en caché, None si no existe.
    """
    try:
        file_hash = _get_file_hash(file_path)
        cache_file = _cache_path(file_hash)

        if not cache_file.exists():
            return None

        print(f"[OCR Cache] Encontrado cache: {cache_file.name}")

        with gzip.open(cache_file, "rt", encoding="utf-8") as f:
            data = json.load(f)

        # Reconstruir OCRPages
        pages = []
        for p in data.get("pages", []):
            pages.append(OCRPage(
                page_number=p["page_number"],
                markdown=p["markdown"],
                images=p.get("images", [])
            ))

        # Reconstruir OCRImages
        images = []
        for img in data.get("images", []):
            images.append(OCRImage(
                id=img["id"],
                image_base64=img["image_base64"],
                annotation=img.get("annotation", "")
            ))

        return OCRResult(
            success=True,
            file_name=data["file_name"],
            pages=pages,
            total_pages=data["total_pages"],
            full_markdown=data["full_markdown"],
            images=images
        )

    except Exception as e:
        print(f"[OCR Cache] Error leyendo cache: {e}")
        return None


def save_ocr_cache(file_path: str, result: OCRResult) -> bool:
    """
    Guarda el resultado OCR en caché.

    Returns:
        True si se guardó correctamente, False si hubo error.
    """
    try:
        file_hash = _get_file_hash(file_path)
        cache_file = _cache_path(file_hash)

        # Serializar a JSON
        data = {
            "file_name": result.file_name,
            "total_pages": result.total_pages,
            "full_markdown": result.full_markdown,
            "pages": [
                {
                    "page_number": p.page_number,
                    "markdown": p.markdown,
                    "images": p.images if isinstance(p.images, list) else []
                }
                for p in result.pages
            ],
            "images": [
                {
                    "id": img.id,
                    "image_base64": img.image_base64,
                    "annotation": img.annotation
                }
                for img in result.images
            ]
        }

        # Guardar comprimido (las imágenes en base64 son grandes)
        with gzip.open(cache_file, "wt", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

        size_kb = cache_file.stat().st_size / 1024
        print(f"[OCR Cache] Guardado: {cache_file.name} ({size_kb:.1f} KB)")
        return True

    except Exception as e:
        print(f"[OCR Cache] Error guardando cache: {e}")
        return False


def list_cache() -> list:
    """Lista todos los archivos en el cache con su información."""
    CACHE_DIR.mkdir(exist_ok=True)
    entries = []

    for cache_file in sorted(CACHE_DIR.glob("*.json.gz")):
        try:
            with gzip.open(cache_file, "rt", encoding="utf-8") as f:
                data = json.load(f)

            size_kb = cache_file.stat().st_size / 1024
            entries.append({
                "hash": cache_file.stem.replace(".json", ""),
                "file_name": data.get("file_name", "Unknown"),
                "total_pages": data.get("total_pages", 0),
                "images": len(data.get("images", [])),
                "markdown_chars": len(data.get("full_markdown", "")),
                "size_kb": round(size_kb, 1),
                "cache_file": str(cache_file)
            })
        except Exception:
            pass

    return entries


def clear_cache(file_path: Optional[str] = None) -> int:
    """
    Elimina entradas del cache.

    Args:
        file_path: Si se especifica, elimina solo el cache de ese archivo.
                   Si es None, elimina todo el cache.

    Returns:
        Número de archivos eliminados.
    """
    deleted = 0

    if file_path:
        file_hash = _get_file_hash(file_path)
        cache_file = _cache_path(file_hash)
        if cache_file.exists():
            cache_file.unlink()
            deleted = 1
    else:
        CACHE_DIR.mkdir(exist_ok=True)
        for cache_file in CACHE_DIR.glob("*.json.gz"):
            cache_file.unlink()
            deleted += 1

    return deleted
