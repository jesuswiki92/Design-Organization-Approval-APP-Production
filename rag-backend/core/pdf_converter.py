import fitz  # PyMuPDF
from typing import Dict, Any, Optional
from pathlib import Path
from core.ocr_processor import OCRResult, OCRPage, OCRImage

class PDFConverter:
    """Gestor de extracción inteligente de PDF."""
    
    MIN_TEXT_DENSITY = 50  # Caracteres promedio por página para considerar texto válido

    def __init__(self):
        pass

    def detect_text_layer(self, file_path: str, checks: int = 3) -> bool:
        """
        Detecta si un PDF tiene una capa de texto extraíble.
        Muestrea hasta 'checks' páginas.
        """
        try:
            doc = fitz.open(file_path)
            if doc.page_count == 0:
                return False
                
            total_chars = 0
            pages_checked = 0
            
            # Check first few pages (skip cover usually dense with text or images)
            indices = list(range(min(checks, doc.page_count)))
            
            for i in indices:
                text = doc[i].get_text()
                total_chars += len(text.strip())
                pages_checked += 1
                
            avg_chars = total_chars / max(1, pages_checked)
            print(f"[PDFConverter] Text detection: {avg_chars:.1f} chars/page avg")
            
            return avg_chars > self.MIN_TEXT_DENSITY
            
        except Exception as e:
            print(f"[PDFConverter] Error detecting text layer: {e}")
            return False

    def convert_to_markdown(self, file_path: str) -> OCRResult:
        """
        Convierte un PDF nativo digital a Markdown usando PyMuPDF.
        Extrae texto estructurado (encabezados, listas, negritas).
        """
        try:
            doc = fitz.open(file_path)
            full_md = ""
            pages = []
            file_name = Path(file_path).name
            
            print(f"[PDFConverter] Extracting markdown from {doc.page_count} pages...")
            
            for i, page in enumerate(doc):
                # Usar el extractor nativo 'markdown' de PyMuPDF (v1.24+)
                # Si una página falla, intentar fallback a texto plano
                try:
                    md = page.get_text("markdown")
                except:
                    md = page.get_text("text") # Fallback
                
                full_md += md + "\n\n"
                
                pages.append(OCRPage(
                    page_number=i+1,
                    markdown=md,
                    images=[]
                ))
                
            return OCRResult(
                success=True,
                file_name=file_name,
                pages=pages,
                total_pages=doc.page_count,
                full_markdown=full_md,
                images=[],
                error_message=None
            )
            
        except Exception as e:
            print(f"[PDFConverter] Conversion failed: {e}")
            return OCRResult(
                success=False,
                file_name=Path(file_path).name,
                pages=[],
                total_pages=0,
                full_markdown="",
                images=[],
                error_message=str(e)
            )
