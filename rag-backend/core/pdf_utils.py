"""
Utilidades para manipulación de PDFs.
"""
import fitz
import os
from pathlib import Path
from typing import List

def split_pdf(file_path: str, chunk_size: int = 50) -> List[str]:
    """
    Divide un PDF en partes más pequeñas de 'chunk_size' páginas.
    Guarda los archivos temporales en la misma carpeta con sufijos _part1, _part2, etc.
    Retorna la lista de rutas a los archivos generados.
    """
    path = Path(file_path)
    doc = fitz.open(file_path)
    total_pages = doc.page_count
    
    if total_pages <= chunk_size:
        doc.close()
        return [file_path]
        
    parts = []
    
    for i in range(0, total_pages, chunk_size):
        start = i
        end = min(i + chunk_size, total_pages)
        
        # Crear nuevo documento con el rango de páginas
        new_doc = fitz.open()
        new_doc.insert_pdf(doc, from_page=start, to_page=end-1)
        
        part_filename = path.stem + f"_part{i//chunk_size + 1}{path.suffix}"
        part_path = path.parent / ".tmp_split" / part_filename
        
        # Asegurar directorio
        part_path.parent.mkdir(exist_ok=True)
        
        new_doc.save(part_path)
        parts.append(str(part_path))
        new_doc.close()
        
    doc.close()
    return parts

def cleanup_parts(parts: List[str]):
    """Elimina los archivos temporales generados."""
    for p in parts:
        try:
            path = Path(p)
            if ".tmp_split" in str(path):
                path.unlink()
        except:
            pass
    # Intentar borrar carpeta si está vacía
    if parts:
        try:
            Path(parts[0]).parent.rmdir()
        except:
            pass
