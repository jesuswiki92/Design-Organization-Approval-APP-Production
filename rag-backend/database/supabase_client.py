"""
Cliente Supabase real para la copia TCDS aislada.
Reemplaza el wrapper de Pinecone anterior.
- Vector store: tabla doa_tcds_embeddings (vector 3072, Gemini)
- Storage capturas: bucket doa-tcds-storage
- Storage figuras: bucket doa-tcds-storage
Mantiene exactamente la misma interfaz pública que el cliente anterior.
"""

import json
import re
import time
import urllib.request
import urllib.parse
import urllib.error
from dataclasses import dataclass
from typing import Any, Optional, List

from config import settings


@dataclass
class UploadResult:
    success: bool
    file_name: str
    public_url: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class SearchResult:
    content: str
    metadata: dict
    similarity: float
    parent_id: Optional[str] = None


# ────────────────────────────────────────────────────────────────
# Helpers HTTP (sin dependencias externas)
# ────────────────────────────────────────────────────────────────

def _supabase_headers(extra: dict = None) -> dict:
    h = {
        "apikey": settings.SUPABASE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def _rest(method: str, path: str, body=None, params: dict = None, extra_headers: dict = None,
          timeout: int = 60) -> Any:
    """HTTP request al REST API de Supabase."""
    base = settings.SUPABASE_URL.rstrip("/")
    url = f"{base}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(body).encode() if body is not None else None
    headers = _supabase_headers(extra_headers)
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {path} → {e.code}: {body_err}") from e


def _storage_upload(bucket: str, path_in_bucket: str, file_bytes: bytes, mime: str = "image/png") -> str:
    """Sube bytes a Supabase Storage y devuelve la URL pública."""
    base = settings.SUPABASE_URL.rstrip("/")
    url = f"{base}/storage/v1/object/{bucket}/{path_in_bucket}"
    headers = {
        "apikey": settings.SUPABASE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_KEY}",
        "Content-Type": mime,
        "x-upsert": "true",
    }
    req = urllib.request.Request(url, data=file_bytes, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Storage upload {bucket}/{path_in_bucket} → {e.code}: {body_err}") from e
    public_url = f"{base}/storage/v1/object/public/{bucket}/{path_in_bucket}"
    return public_url


# ────────────────────────────────────────────────────────────────
# Cliente principal
# ────────────────────────────────────────────────────────────────

TABLE = settings.SUPABASE_TABLE
BUCKET_CAPTURES = settings.SUPABASE_STORAGE_BUCKET
BUCKET_IMAGES   = settings.SUPABASE_STORAGE_BUCKET


class SupabaseClient:
    """
    Cliente real sobre Supabase (PostgreSQL + pgvector + Storage).
    Misma interfaz que el wrapper Pinecone anterior.
    """

    def __init__(self, url: Optional[str] = None, key: Optional[str] = None):
        if url:
            settings.SUPABASE_URL = url
        if key:
            settings.SUPABASE_KEY = key
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise ValueError("SUPABASE_URL y SUPABASE_KEY son requeridas")

    # ==================== STORAGE ====================

    def upload_image(self, image_bytes_or_b64, file_name: Optional[str] = None,
                     bucket: str = BUCKET_IMAGES) -> UploadResult:
        """
        Sube una imagen a Supabase Storage.
        Acepta bytes directos o string base64.
        """
        try:
            if not file_name:
                file_name = f"{int(time.time() * 1000)}.jpg"

            if isinstance(image_bytes_or_b64, str):
                import base64 as _b64
                if "base64," in image_bytes_or_b64:
                    image_bytes_or_b64 = image_bytes_or_b64.split("base64,", 1)[1]
                file_bytes = _b64.b64decode(image_bytes_or_b64)
            else:
                file_bytes = image_bytes_or_b64

            ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else "jpg"
            mime_map = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                        "webp": "image/webp", "gif": "image/gif"}
            mime = mime_map.get(ext, "image/jpeg")

            public_url = _storage_upload(bucket, file_name, file_bytes, mime)
            return UploadResult(success=True, file_name=file_name, public_url=public_url)
        except Exception as e:
            return UploadResult(success=False, file_name=file_name or "unknown", error_message=str(e))

    def upload_capture(self, file_bytes: bytes, file_name: str) -> UploadResult:
        """Sube captura de página al bucket TCDS configurado."""
        return self.upload_image(file_bytes, file_name, bucket=BUCKET_CAPTURES)

    def upload_images_batch(self, images: list) -> list:
        results = []
        for img in images:
            img_b64 = img.get("image_base64", img.get("base64", ""))
            img_id = img.get("id", None)
            result = self.upload_image(img_b64, img_id)
            results.append({
                "original_id": img_id,
                "file_name": result.file_name,
                "public_url": result.public_url,
                "success": result.success,
                "error": result.error_message,
            })
        return results

    # ==================== VECTORES ====================

    @staticmethod
    def _format_embedding(emb) -> str:
        """Convert embedding list to string format required by PostgREST for vector columns.

        PostgREST cannot cast a native JSON array to a PostgreSQL vector type.
        It needs the value as a string like "[0.1,0.2,...]" so PostgreSQL can
        parse it through its own vector input function.
        """
        if isinstance(emb, str):
            return emb
        return "[" + ",".join(str(float(v)) for v in emb) + "]"

    def insert_document(self, content: str, embedding: list, metadata: dict,
                        parent_id: Optional[str] = None,
                        table_name: str = TABLE) -> bool:
        if not content or not content.strip():
            print("[X] content vacío")
            return False
        if not embedding or len(embedding) != settings.EMBEDDING_DIM:
            print(f"[X] embedding inválido ({len(embedding) if embedding else 0} dims)")
            return False
        if not isinstance(metadata, dict):
            print(f"[X] metadata no es dict: {type(metadata)}")
            return False
        try:
            record = {
                "content": content,
                "embedding": self._format_embedding(embedding),
                "metadata": metadata,
                "parent_id": parent_id,
            }
            _rest("POST", f"/rest/v1/{TABLE}", body=record,
                  extra_headers={"Prefer": "return=minimal"})
            return True
        except Exception as e:
            print(f"[X] insert_document error: {e}")
            return False

    def insert_documents_batch(self, documents: list, embeddings: list,
                               table_name: str = TABLE) -> dict:
        if len(documents) != len(embeddings):
            return {"total": len(documents), "successful": 0,
                    "failed": len(documents), "error": "count mismatch"}
        if not documents:
            return {"total": 0, "successful": 0, "failed": 0}

        # Batch insert en lotes de 50
        successful = 0
        failed = 0
        failed_chunks = []
        errors = []
        BATCH = 50

        for start in range(0, len(documents), BATCH):
            batch_docs = documents[start:start + BATCH]
            batch_embs = embeddings[start:start + BATCH]
            records = []
            skipped = 0
            for doc, emb in zip(batch_docs, batch_embs):
                content = doc.get("content", "")
                if not content.strip() or not emb:
                    skipped += 1
                    continue
                records.append({
                    "content": content,
                    "embedding": self._format_embedding(emb),
                    "metadata": doc.get("metadata", {}),
                    "parent_id": doc.get("parent_id"),
                })
            if not records:
                failed += len(batch_docs)
                continue
            try:
                result = _rest("POST", f"/rest/v1/{TABLE}", body=records,
                               extra_headers={"Prefer": "return=representation",
                                              "Accept": "application/json"})
                # return=representation gives back inserted rows
                inserted = len(result) if isinstance(result, list) else (1 if result else 0)
                successful += inserted
                not_inserted = len(records) - inserted
                failed += not_inserted + skipped
                if not_inserted > 0:
                    errors.append(f"Batch at {start}: sent {len(records)} but only {inserted} inserted")
            except Exception as e:
                print(f"[X] batch insert error (start={start}): {e}")
                failed += len(batch_docs)
                errors.append(f"Batch at {start}: {e}")
                for doc in batch_docs:
                    failed_chunks.append(doc.get("metadata", {}).get("chunk_id", "?"))

        result_dict = {
            "total": len(documents),
            "successful": successful,
            "failed": failed,
            "failed_chunks": failed_chunks,
        }
        if errors:
            result_dict["errors"] = errors
        return result_dict

    def search_similar(self, query_embedding: list, top_k: int = 10,
                       table_name: str = TABLE,
                       match_function: str = "match_doa_tcds") -> List[SearchResult]:
        try:
            payload = {
                "query_embedding": query_embedding,
                "match_count": top_k,
                "filter_code": None,
                "similarity_threshold": 0.0,
            }
            rows = _rest("POST", f"/rest/v1/rpc/{match_function}", body=payload)
            return [self._row_to_result(r) for r in (rows or [])]
        except Exception as e:
            print(f"[X] search_similar error: {e}")
            return []

    def hybrid_search(self, query_embedding: list, query_text: str,
                      top_k: int = 20) -> List[SearchResult]:
        """Intenta búsqueda híbrida; si falla (sin coincidencias texto), cae a vectorial."""
        try:
            payload = {
                "query_embedding": query_embedding,
                "query_text": query_text,
                "match_count": top_k,
            }
            rows = _rest("POST", "/rest/v1/rpc/hybrid_search_doa_tcds", body=payload)
            if rows:
                return [self._row_to_hybrid_result(r) for r in rows]
            # Sin resultados de texto → fallback vectorial
            return self.search_similar(query_embedding, top_k)
        except Exception as e:
            print(f"[WARN] hybrid_search error, fallback vectorial: {e}")
            return self.search_similar(query_embedding, top_k)

    def search_section_by_id(self, section_id: str,
                             doc_code_hint: Optional[str] = None) -> Optional[SearchResult]:
        """Busca un chunk por section_id exacto o aproximado."""
        try:
            # Filtro PostgREST por metadata->>'section_id'
            params: dict = {
                "select": "id,content,metadata,parent_id",
                "limit": "50",
            }
            if doc_code_hint:
                params["metadata->>official_code"] = f"ilike.%{doc_code_hint}%"

            rows = _rest("GET", f"/rest/v1/{TABLE}", params=params)
            if not rows:
                return None

            norm_q = self._normalize_text(section_id)
            cs_m = re.search(r"(?:cs[_\s-]*)?23[._-]?(\d{3,4})", section_id, re.IGNORECASE)
            cs_digits = cs_m.group(1) if cs_m else ""

            best_score, best_row = -1, None
            for row in rows:
                meta = row.get("metadata", {})
                sid = str(meta.get("section_id", ""))
                nsid = str(meta.get("normalized_section_id", ""))
                haystack = self._normalize_text(f"{sid} {nsid}")
                score = 0
                if nsid and norm_q and nsid == norm_q:
                    score = 100
                elif sid and sid.lower() == section_id.lower():
                    score = 95
                elif norm_q and norm_q in haystack:
                    score = 80
                elif cs_digits and cs_digits in re.sub(r"\D+", "", sid):
                    score = 70
                elif section_id.lower() in row.get("content", "").lower():
                    score = 40
                if score > best_score:
                    best_score, best_row = score, row
            return self._row_to_result(best_row, similarity=1.0) if best_row and best_score > 0 else None
        except Exception as e:
            print(f"[X] search_section_by_id error: {e}")
            return None

    def get_chunk_by_id(self, chunk_id: str, table_name: str = TABLE) -> Optional[SearchResult]:
        try:
            rows = _rest("GET", f"/rest/v1/{TABLE}", params={
                "select": "id,content,metadata,parent_id",
                "or": f"(metadata->>chunk_id.eq.{chunk_id})",
                "limit": "1",
            })
            if rows:
                return self._row_to_result(rows[0], similarity=1.0)
            return None
        except Exception:
            return None

    def get_parent_context(self, parent_id: str, table_name: str = TABLE) -> Optional[str]:
        chunk = self.get_chunk_by_id(parent_id)
        return chunk.content if chunk else None

    def get_children_chunks(self, parent_chunk_id: str,
                            table_name: str = TABLE) -> List[SearchResult]:
        try:
            rows = _rest("GET", f"/rest/v1/{TABLE}", params={
                "select": "id,content,metadata,parent_id",
                "parent_id": f"eq.{parent_chunk_id}",
                "limit": "50",
            })
            results = [self._row_to_result(r, similarity=1.0) for r in (rows or [])]
            results.sort(key=lambda x: x.metadata.get("section_id", ""))
            return results
        except Exception:
            return []

    def get_all_section_parts(self, section_id: str, official_code: str,
                              table_name: str = TABLE) -> List[SearchResult]:
        try:
            rows = _rest("GET", f"/rest/v1/{TABLE}", params={
                "select": "id,content,metadata,parent_id",
                "limit": "100",
            })
            results = []
            for row in (rows or []):
                meta = row.get("metadata", {})
                sid = str(meta.get("section_id", ""))
                if meta.get("official_code") == official_code and sid.startswith(section_id):
                    results.append(self._row_to_result(row, similarity=1.0))
            results.sort(key=lambda x: x.metadata.get("section_id", ""))
            return results
        except Exception:
            return []

    def get_hierarchical_context(self, chunk_id: str, max_levels: int = 2,
                                 table_name: str = TABLE) -> List[str]:
        contexts = []
        current_id = chunk_id
        for _ in range(max_levels):
            chunk = self.get_chunk_by_id(current_id)
            if not chunk:
                break
            parent_id = chunk.parent_id or chunk.metadata.get("parent_id")
            if not parent_id:
                break
            parent = self.get_chunk_by_id(parent_id)
            if not parent:
                break
            contexts.insert(0, parent.content)
            current_id = parent_id
        return contexts

    def get_unique_documents(self) -> list:
        """Devuelve documentos únicos por official_code."""
        try:
            rows = _rest("GET", f"/rest/v1/{TABLE}", params={
                "select": "metadata",
                "limit": "2000",
            })
            docs: dict[str, dict] = {}
            for row in (rows or []):
                meta = row.get("metadata", {})
                code = meta.get("official_code")
                if not code:
                    continue
                if code not in docs:
                    docs[code] = {
                        "code": code,
                        "title": meta.get("document_title", meta.get("title", "Unknown Title")),
                        "agency": meta.get("agency", "Unknown Agency"),
                        "doc_type": meta.get("doc_type", "Unknown Type"),
                        "chunks": 0,
                    }
                docs[code]["chunks"] += 1
            return list(docs.values())
        except Exception as e:
            print(f"[X] get_unique_documents error: {e}")
            return []

    def check_document_exists(self, official_code: str,
                              table_name: str = TABLE) -> bool:
        try:
            rows = _rest("GET", f"/rest/v1/{TABLE}", params={
                "select": "id",
                "metadata->>official_code": f"eq.{official_code}",
                "limit": "1",
            })
            return bool(rows)
        except Exception:
            return False

    def delete_document_by_code(self, official_code: str,
                                table_name: str = TABLE) -> int:
        try:
            rows = _rest("GET", f"/rest/v1/{TABLE}", params={
                "select": "id",
                "metadata->>official_code": f"eq.{official_code}",
                "limit": "2000",
            })
            if not rows:
                return 0
            ids = [str(r["id"]) for r in rows]
            # Borrar en lotes
            deleted = 0
            BATCH = 100
            for start in range(0, len(ids), BATCH):
                batch_ids = ids[start:start + BATCH]
                id_list = ",".join(batch_ids)
                _rest("DELETE", f"/rest/v1/{TABLE}", params={"id": f"in.({id_list})"})
                deleted += len(batch_ids)
            return deleted
        except Exception as e:
            print(f"[X] delete_document_by_code error: {e}")
            return 0

    def get_stats(self, table_name: str = TABLE) -> dict:
        docs = self.get_unique_documents()
        return {
            "total_chunks": sum(d["chunks"] for d in docs),
            "unique_documents": len(docs),
            "document_codes": sorted(d["code"] for d in docs),
        }

    # ==================== INTERNOS ====================

    def _row_to_result(self, row: dict, similarity: float = 0.0) -> SearchResult:
        meta = row.get("metadata", {}) or {}
        result = SearchResult(
            content=row.get("content", ""),
            metadata=meta,
            similarity=float(row.get("similarity", similarity)),
            parent_id=row.get("parent_id"),
        )
        result.id = row.get("id")
        return result

    def _row_to_hybrid_result(self, row: dict) -> SearchResult:
        result = self._row_to_result(row)
        # Combinar similarity + text_rank (mismo peso que en la función SQL)
        sim = float(row.get("similarity", 0.0))
        trank = float(row.get("text_rank", 0.0))
        result.similarity = sim * 0.7 + trank * 0.3
        return result

    def _normalize_text(self, value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())
