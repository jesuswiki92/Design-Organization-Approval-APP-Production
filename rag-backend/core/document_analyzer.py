"""
Analizador de documentos PDF.
Detecta estructura, número de páginas y sugiere partición para documentos grandes.
"""

import fitz  # PyMuPDF
from pathlib import Path
from dataclasses import dataclass
from typing import Optional
from config import settings


@dataclass
class DocumentInfo:
    """Información extraída de un documento PDF."""
    file_path: str
    file_name: str
    num_pages: int
    file_size_mb: float
    has_images: bool
    has_toc: bool  # Table of Contents
    toc_entries: list
    is_large: bool
    suggested_splits: list
    metadata: dict


@dataclass
class SplitSuggestion:
    """Sugerencia de división del documento."""
    title: str
    start_page: int
    end_page: int
    num_pages: int


class DocumentAnalyzer:
    """Analiza documentos PDF para determinar su estructura y si necesitan partición."""
    
    def __init__(self, large_doc_threshold: int = None):
        self.large_doc_threshold = large_doc_threshold or settings.LARGE_DOC_THRESHOLD
    
    def analyze(self, file_path: str) -> DocumentInfo:
        """
        Analiza un documento PDF y retorna información detallada.
        
        Args:
            file_path: Ruta al archivo PDF
            
        Returns:
            DocumentInfo con toda la información del documento
        """
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"No se encontró el archivo: {file_path}")
        
        if path.suffix.lower() != '.pdf':
            raise ValueError(f"El archivo debe ser PDF, se recibió: {path.suffix}")
        
        # Abrir el documento
        doc = fitz.open(file_path)
        
        try:
            # Información básica
            num_pages = len(doc)
            file_size_mb = path.stat().st_size / (1024 * 1024)
            
            # Detectar si tiene imágenes (revisar primeras 5 páginas)
            has_images = self._detect_images(doc, max_pages=5)
            
            # Obtener tabla de contenidos
            toc = doc.get_toc()
            has_toc = len(toc) > 0
            toc_entries = self._parse_toc(toc)
            
            # Determinar si es documento grande
            is_large = num_pages > self.large_doc_threshold
            
            # Sugerir divisiones si es grande
            suggested_splits = []
            if is_large:
                suggested_splits = self._suggest_splits(toc_entries, num_pages)
            
            # Metadata del PDF
            metadata = doc.metadata or {}
            
            return DocumentInfo(
                file_path=str(path.absolute()),
                file_name=path.name,
                num_pages=num_pages,
                file_size_mb=round(file_size_mb, 2),
                has_images=has_images,
                has_toc=has_toc,
                toc_entries=toc_entries,
                is_large=is_large,
                suggested_splits=suggested_splits,
                metadata={
                    "title": metadata.get("title", ""),
                    "author": metadata.get("author", ""),
                    "subject": metadata.get("subject", ""),
                    "creator": metadata.get("creator", ""),
                }
            )
        finally:
            doc.close()
    
    def _detect_images(self, doc: fitz.Document, max_pages: int = 5) -> bool:
        """Detecta si el documento contiene imágenes."""
        pages_to_check = min(len(doc), max_pages)
        
        for page_num in range(pages_to_check):
            page = doc[page_num]
            image_list = page.get_images()
            if image_list:
                return True
        return False
    
    def _parse_toc(self, toc: list) -> list:
        """Parsea la tabla de contenidos del PDF."""
        entries = []
        for item in toc:
            level, title, page = item[0], item[1], item[2]
            entries.append({
                "level": level,
                "title": title.strip(),
                "page": page
            })
        return entries
    
    def _suggest_splits(self, toc_entries: list, total_pages: int) -> list:
        """
        Sugiere cómo dividir el documento basándose en la tabla de contenidos.
        """
        suggestions = []
        
        if not toc_entries:
            # Sin TOC, dividir por número de páginas
            chunk_size = 50  # páginas por sección
            for i in range(0, total_pages, chunk_size):
                end_page = min(i + chunk_size, total_pages)
                suggestions.append(SplitSuggestion(
                    title=f"Sección {len(suggestions) + 1}",
                    start_page=i + 1,
                    end_page=end_page,
                    num_pages=end_page - i
                ))
        else:
            # Con TOC, usar los capítulos principales (nivel 1)
            level1_entries = [e for e in toc_entries if e["level"] == 1]
            
            if not level1_entries:
                level1_entries = toc_entries[:10]  # Usar primeras 10 entradas
            
            for i, entry in enumerate(level1_entries):
                start_page = entry["page"]
                
                # Determinar página final
                if i + 1 < len(level1_entries):
                    end_page = level1_entries[i + 1]["page"] - 1
                else:
                    end_page = total_pages
                
                if end_page >= start_page:
                    suggestions.append(SplitSuggestion(
                        title=entry["title"][:50],  # Limitar longitud
                        start_page=start_page,
                        end_page=end_page,
                        num_pages=end_page - start_page + 1
                    ))
        
        return suggestions
    
    def extract_pages(self, file_path: str, start_page: int, end_page: int, 
                      output_path: Optional[str] = None) -> str:
        """
        Extrae un rango de páginas del PDF y las guarda en un nuevo archivo.
        
        Args:
            file_path: Ruta al PDF original
            start_page: Página inicial (1-indexed)
            end_page: Página final (1-indexed)
            output_path: Ruta de salida (opcional)
            
        Returns:
            Ruta al nuevo archivo PDF
        """
        doc = fitz.open(file_path)
        
        try:
            # Crear nuevo documento
            new_doc = fitz.open()
            
            # Ajustar a 0-indexed
            start_idx = start_page - 1
            end_idx = end_page
            
            # Insertar páginas
            new_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx - 1)
            
            # Determinar ruta de salida
            if output_path is None:
                original_path = Path(file_path)
                output_path = original_path.parent / f"{original_path.stem}_p{start_page}-{end_page}.pdf"
            
            # Guardar
            new_doc.save(str(output_path))
            new_doc.close()
            
            return str(output_path)
        finally:
            doc.close()
    
    def get_analysis_summary(self, doc_info: DocumentInfo) -> str:
        """Genera un resumen legible del análisis."""
        summary = f"""
[DOC] **{doc_info.file_name}**
-------------------------------
[INFO] Paginas: {doc_info.num_pages}
[SAVE] Tamano: {doc_info.file_size_mb} MB
[IMG] Contiene imagenes: {'Si' if doc_info.has_images else 'No'}
[TOC] Tiene indice: {'Si' if doc_info.has_toc else 'No'}
"""

        if doc_info.is_large:
            summary += f"""
[WARN] **DOCUMENTO GRANDE DETECTADO**
Se recomienda dividir el documento para mejor procesamiento.

[LIST] Sugerencias de division:
"""
            for i, split in enumerate(doc_info.suggested_splits, 1):
                summary += f"  {i}. {split.title} (págs. {split.start_page}-{split.end_page}, {split.num_pages} págs.)\n"
        
        return summary