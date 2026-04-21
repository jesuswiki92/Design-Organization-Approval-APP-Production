"""
Procesador OCR usando Mistral AI.
Extrae texto e imágenes de documentos PDF.
"""

import httpx
import base64
import time
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, Callable
from config import settings


@dataclass
class OCRPage:
    """Representa una página procesada por OCR."""
    page_number: int
    markdown: str
    images: list = field(default_factory=list)


@dataclass
class OCRImage:
    """Representa una imagen extraída del documento."""
    id: str
    image_base64: str
    annotation: str


@dataclass
class OCRResult:
    """Resultado completo del procesamiento OCR."""
    success: bool
    file_name: str
    pages: list  # Lista de OCRPage
    total_pages: int
    full_markdown: str
    images: list  # Lista de todas las imágenes
    error_message: Optional[str] = None


class MistralOCRProcessor:
    """
    Procesa documentos PDF usando Mistral OCR API.
    Extrae texto en formato Markdown e imágenes con descripciones.
    """
    
    BASE_URL = "https://api.mistral.ai/v1"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.MISTRAL_API_KEY
        
        if not self.api_key:
            raise ValueError("MISTRAL_API_KEY no está configurada")
        
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json"
        }
    
    def process_pdf(self, file_path: str, chunk_size: int = 50,
                    progress_callback: Optional[Callable[[str, int], None]] = None) -> OCRResult:
        """
        Procesa un documento PDF completo.
        Si es grande (> chunk_size páginas), lo divide y procesa por partes.
        """
        path = Path(file_path)
        
        if not path.exists():
            return OCRResult(False, path.name, [], 0, "", [], f"Archivo no encontrado: {file_path}")

        try:
            # 1. Comprobar tamaño
            import fitz
            doc = fitz.open(file_path)
            total_pages = doc.page_count
            doc.close()
            
            if total_pages > chunk_size:
                if progress_callback:
                    progress_callback(f"Documento grande ({total_pages} pág). Dividiendo en partes de {chunk_size}...", 5)
                
                # Importar utilidad de división (lazy import para evitar ciclos si hubiera)
                from core.pdf_utils import split_pdf, cleanup_parts
                
                parts = split_pdf(file_path, chunk_size=chunk_size)
                all_pages = []
                all_images = []
                full_md = ""
                
                for idx, part_path in enumerate(parts):
                    part_num = idx + 1
                    total_p = len(parts)
                    pct_start = 10 + int((idx / total_p) * 80)
                    
                    if progress_callback:
                        progress_callback(f"Procesando parte {part_num}/{total_p} ({Path(part_path).name})...", pct_start)
                    
                    # Recursiva (pero ahora entra en el 'else' porque es pequeño)
                    # Ojo: Recursión causaría re-split si chunk_size < 50. 
                    # El split ya garantiza tamaño <= chunk_size.
                    res = self.process_pdf(part_path, chunk_size=total_pages+1, progress_callback=None)
                    
                    if not res.success:
                        cleanup_parts(parts)
                        return OCRResult(False, path.name, [], 0, "", [], f"Error en parte {part_num}: {res.error_message}")
                    
                    # Ajustar números de página
                    offset = idx * chunk_size
                    for p in res.pages:
                        p.page_number += offset
                    
                    all_pages.extend(res.pages)
                    all_images.extend(res.images)
                    full_md += res.full_markdown + "\n\n"
                
                cleanup_parts(parts)
                
                if progress_callback:
                    progress_callback("¡Procesamiento completo!", 100)
                    
                return OCRResult(
                    success=True,
                    file_name=path.name,
                    pages=all_pages,
                    total_pages=total_pages,
                    full_markdown=full_md,
                    images=all_images
                )
            
            # --- PROCESAMIENTO ESTÁNDAR (Documento pequeño) ---
            
            # Paso 1: Subir archivo a Mistral
            if progress_callback:
                progress_callback("Subiendo archivo a Mistral AI...", 10)
            
            file_id = self._upload_file(file_path)
            
            if not file_id:
                return OCRResult(False, path.name, [], 0, "", [], "Error al subir archivo")
            
            # Paso 2: Obtener URL firmada
            if progress_callback:
                progress_callback("Obteniendo URL del documento...", 30)
            
            signed_url = self._get_signed_url(file_id)
            
            if not signed_url:
                return OCRResult(False, path.name, [], 0, "", [], "Error al obtener URL firmada")
            
            # Paso 3: Ejecutar OCR (ahora con timeout de 20 min que pusimos antes)
            if progress_callback:
                progress_callback("Ejecutando OCR...", 50)
            
            ocr_response = self._run_ocr(signed_url)
            
            if not ocr_response:
                return OCRResult(False, path.name, [], 0, "", [], "Error al ejecutar OCR (posible timeout)")
            
            # Paso 4: Procesar respuesta
            if progress_callback:
                progress_callback("Procesando resultados...", 80)
            
            pages, images = self._parse_ocr_response(ocr_response)
            full_markdown = "\n\n".join([page.markdown for page in pages])
            
            if progress_callback:
                progress_callback("¡Completado!", 100)
            
            return OCRResult(
                success=True,
                file_name=path.name,
                pages=pages,
                total_pages=len(pages),
                full_markdown=full_markdown,
                images=images
            )
            
        except Exception as e:
            return OCRResult(False, path.name, [], 0, "", [], f"Excepción global: {str(e)}")
    
    def _upload_file(self, file_path: str) -> Optional[str]:
        """Sube un archivo a Mistral AI."""
        url = f"{self.BASE_URL}/files"
        
        try:
            with open(file_path, "rb") as f:
                files = {
                    "file": (Path(file_path).name, f, "application/pdf"),
                    "purpose": (None, "ocr")
                }
                
                with httpx.Client(timeout=300) as client:
                    response = client.post(
                        url,
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        files=files
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        return data.get("id")
                    else:
                        print(f"Error subiendo archivo: {response.status_code} - {response.text}")
                        return None
                        
        except Exception as e:
            print(f"Excepción subiendo archivo: {e}")
            return None
    
    def _get_signed_url(self, file_id: str, expiry_hours: int = 24) -> Optional[str]:
        """Obtiene una URL firmada para el archivo."""
        url = f"{self.BASE_URL}/files/{file_id}/url"
        
        try:
            with httpx.Client(timeout=60) as client:
                response = client.get(
                    url,
                    headers=self.headers,
                    params={"expiry": expiry_hours}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get("url")
                else:
                    print(f"Error obteniendo URL: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            print(f"Excepción obteniendo URL: {e}")
            return None
    
    def _run_ocr(self, document_url: str) -> Optional[dict]:
        """Ejecuta el OCR en el documento."""
        url = f"{self.BASE_URL}/ocr"
        
        payload = {
            "model": settings.MISTRAL_OCR_MODEL,
            "document": {
                "type": "document_url",
                "document_url": document_url
            },
            "include_image_base64": True,
            "bbox_annotation_format": {
                "type": "text",
                "json_schema": {
                    "name": "visual_descriptions_only",
                    "description": "Extrae descripciones concisas en lenguaje natural en ESPAÑOL para cada elemento visual distinto (imagen, gráfico, tabla, diagrama, etc.) en la página. Enfócate en resumir lo que contiene o comunica cada elemento visual.",
                    "schema": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "description": "Una descripción concisa de un solo elemento visual."
                        }
                    },
                    "strict": False
                }
            }
        }
        
        try:
            with httpx.Client(timeout=1200.0) as client:  # 20 minutos para documentos grandes
                response = client.post(
                    url,
                    headers={**self.headers, "Content-Type": "application/json"},
                    json=payload
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    print(f"Error en OCR: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            print(f"Excepción en OCR: {e}")
            return None
    
    def _parse_ocr_response(self, response: dict) -> tuple:
        """Parsea la respuesta del OCR y extrae páginas e imágenes."""
        pages = []
        all_images = []
        
        ocr_pages = response.get("pages", [])
        
        for idx, page_data in enumerate(ocr_pages):
            page_markdown = page_data.get("markdown", "")
            page_images = []
            
            # Extraer imágenes de la página
            for img_data in page_data.get("images", []):
                img_id = img_data.get("id", f"img_{idx}_{len(page_images)}")
                img_base64 = img_data.get("image_base64", "")
                
                # Obtener anotación si existe
                annotation = ""
                if "image_annotation" in img_data:
                    annotation = img_data.get("image_annotation", "")
                
                ocr_image = OCRImage(
                    id=img_id,
                    image_base64=img_base64,
                    annotation=annotation
                )
                
                page_images.append(ocr_image)
                all_images.append(ocr_image)
            
            ocr_page = OCRPage(
                page_number=idx + 1,
                markdown=page_markdown,
                images=page_images
            )
            pages.append(ocr_page)
        
        return pages, all_images
    
    def get_processing_summary(self, result: OCRResult) -> str:
        """Genera un resumen del procesamiento OCR."""
        if not result.success:
            return f"""
[ERROR] **Error en el procesamiento OCR**
-------------------------------
Archivo: {result.file_name}
[WARN] Error: {result.error_message}
"""

        return f"""
[OK] **OCR Completado Exitosamente**
-------------------------------
Archivo: {result.file_name}
[DOC] Paginas procesadas: {result.total_pages}
[IMG] Imagenes extraidas: {len(result.images)}
[TXT] Caracteres de texto: {len(result.full_markdown):,}
"""