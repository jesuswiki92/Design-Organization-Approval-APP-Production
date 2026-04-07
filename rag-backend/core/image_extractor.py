"""
Extractor de imágenes de PDFs.
Extrae imágenes con PyMuPDF, las sube a Supabase Storage usando el bucket
configurado por la capa de datos TCDS, y devuelve un mapeo página→URLs para
vincular con chunks.
"""

import fitz
import hashlib
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

from database.supabase_client import SupabaseClient, BUCKET_IMAGES
from utils.logger import logger


MIN_IMAGE_SIZE_KB = 5  # Ignorar imágenes menores a 5KB (iconos/logos)


@dataclass
class ExtractedImage:
    """Imagen extraída de un PDF."""
    page_number: int
    xref: int
    image_bytes: bytes
    extension: str
    width: int
    height: int
    size_kb: float
    hash: str


@dataclass
class ImageMapping:
    """Resultado de procesar imágenes de un PDF."""
    page_to_urls: dict = field(default_factory=dict)
    total_extracted: int = 0
    total_uploaded: int = 0
    total_skipped: int = 0
    all_urls: list = field(default_factory=list)


def extract_images_from_pdf(
    pdf_path: str,
    min_size_kb: float = MIN_IMAGE_SIZE_KB,
    progress_callback=None
) -> list:
    """
    Extrae imágenes significativas de un PDF usando PyMuPDF.
    Filtra iconos pequeños y deduplica por hash.
    """
    doc = fitz.open(pdf_path)
    images = []
    seen_hashes = set()

    for page_num in range(doc.page_count):
        page = doc[page_num]
        page_images = page.get_images(full=True)

        for img_info in page_images:
            xref = img_info[0]
            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                size_kb = len(image_bytes) / 1024

                if size_kb < min_size_kb:
                    continue

                img_hash = hashlib.md5(image_bytes).hexdigest()
                if img_hash in seen_hashes:
                    continue
                seen_hashes.add(img_hash)

                images.append(ExtractedImage(
                    page_number=page_num + 1,
                    xref=xref,
                    image_bytes=image_bytes,
                    extension=base_image["ext"],
                    width=base_image["width"],
                    height=base_image["height"],
                    size_kb=round(size_kb, 1),
                    hash=img_hash,
                ))
            except Exception as e:
                logger.warning(f"Error extrayendo imagen xref={xref} pag {page_num+1}: {e}")

    doc.close()

    if progress_callback:
        progress_callback(f"Extraídas {len(images)} imágenes significativas", 0)

    return images


def upload_images_to_storage(
    images: list,
    official_code: str,
    supabase_client: Optional[SupabaseClient] = None,
    progress_callback=None
) -> ImageMapping:
    """
    Sube imágenes extraídas al bucket configurado por la capa de datos TCDS.
    Devuelve el mapeo página→URLs públicas.
    """
    if not images:
        return ImageMapping()

    client = supabase_client or SupabaseClient()
    mapping = ImageMapping()

    safe_code = official_code.replace("/", "_").replace(" ", "_").replace(".", "_")

    for idx, img in enumerate(images):
        if progress_callback:
            pct = int((idx / len(images)) * 100)
            progress_callback(f"Subiendo imagen {idx+1}/{len(images)}", pct)

        ext = img.extension if img.extension else "jpg"
        file_name = f"{safe_code}_p{img.page_number}_x{img.xref}.{ext}"

        result = client.upload_image(img.image_bytes, file_name, bucket=BUCKET_IMAGES)

        if result.success and result.public_url:
            if img.page_number not in mapping.page_to_urls:
                mapping.page_to_urls[img.page_number] = []

            mapping.page_to_urls[img.page_number].append({
                "url": result.public_url,
                "width": img.width,
                "height": img.height,
                "size_kb": img.size_kb,
                "file_name": file_name,
            })

            mapping.all_urls.append(result.public_url)
            mapping.total_uploaded += 1
            logger.info(f"[IMG] Imagen subida: {file_name} ({img.width}x{img.height})")
        else:
            logger.warning(f"[X] Error subiendo {file_name}: {result.error_message}")

        mapping.total_extracted += 1

    mapping.total_skipped = len(images) - mapping.total_uploaded

    if progress_callback:
        progress_callback(f"Imágenes subidas: {mapping.total_uploaded}/{len(images)}", 100)

    return mapping


def assign_images_to_chunks(chunks: list, image_mapping: ImageMapping,
                            pages_per_batch: int = 50, batch_offset: int = 0) -> list:
    """
    Asigna URLs de imágenes a los chunks correspondientes.
    Los chunks que mencionan figuras/diagramas reciben las URLs.
    """
    if not image_mapping or not image_mapping.page_to_urls:
        return chunks

    all_urls = []
    for page_num, img_list in image_mapping.page_to_urls.items():
        for img_info in img_list:
            all_urls.append(img_info["url"])

    if not all_urls:
        return chunks

    import re
    fig_pattern = re.compile(
        r'(?:FIG\.?\s*|Figure\s*|Fig\s+|Diagram|Appendix\s+X)'
        r'(\d+|X\d+[\.\d]*)',
        re.IGNORECASE
    )

    linked_count = 0

    for chunk in chunks:
        content = chunk.get("content", "")
        mentions = fig_pattern.findall(content)

        if mentions:
            if "metadata" not in chunk:
                chunk["metadata"] = {}
            chunk["metadata"]["image_urls"] = list(all_urls)
            chunk["has_image"] = True
            linked_count += 1

    if linked_count == 0 and chunks:
        if "metadata" not in chunks[0]:
            chunks[0]["metadata"] = {}
        chunks[0]["metadata"]["image_urls"] = list(all_urls)
        chunks[0]["has_image"] = True
        linked_count = 1

    logger.info(f"[IMG] {linked_count} chunks linked with {len(all_urls)} image URLs")
    return chunks
