"""
FastAPI server that wraps the existing Python RAG modules.
Exposes REST endpoints for the React frontend.
"""

import json
import os
import re
import sys
import traceback
from pathlib import Path
from typing import Optional

# Add parent directory to path so we can import project modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from config.settings import settings
# Auth imports kept for /api/auth/login endpoint (optional, DOA app has its own auth)
from api.auth import get_current_user, create_access_token, verify_password, oauth2_scheme

app = FastAPI(title="RAG Aeronatic Final API", version="2.0.0")


def _get_real_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host or "unknown"


limiter = Limiter(key_func=_get_real_ip)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
print(f"[CORS] ALLOWED_ORIGINS resolved to: {settings.ALLOWED_ORIGINS}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_private_network=True,
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# ── Metadata enrichment helpers ───────────────────────────────────

def _build_section_path(chunk: dict) -> str:
    chapter = chunk.get("metadata", {}).get("chapter", "") or ""
    section_id = chunk.get("section_id", "") or ""
    section_title = chunk.get("section_title", "") or ""
    if chapter and section_id:
        return f"{chapter} > {section_id} {section_title}".strip()
    elif section_id:
        return f"{section_id} {section_title}".strip()
    return section_title


def _normalize_search_text(content: str) -> str:
    """Remove breadcrumb prefix and normalize whitespace."""
    if content.startswith("**[") and "\n\n" in content:
        content = content.split("\n\n", 1)[1]
    return " ".join(content.split())[:2000]  # cap at 2000 chars


# ── Lazy-loaded singletons ─────────────────────────────────────────
_agent = None
_db = None

# Use /app/data in Docker (volume-mounted), fallback to api/ locally
_DATA_DIR = Path("/app/data") if Path("/app/data").exists() else Path(__file__).resolve().parent
MODEL_CONFIG_PATH = _DATA_DIR / "model_config.json"


def _load_model_config() -> dict:
    if MODEL_CONFIG_PATH.exists():
        with open(MODEL_CONFIG_PATH) as f:
            return json.load(f)
    return {"id": "openai/gpt-4o", "name": "GPT-4o", "temperature": 0.2}


def _save_model_config(cfg: dict):
    with open(MODEL_CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)


def get_db():
    global _db
    if _db is None:
        from database.supabase_client import SupabaseClient
        _db = SupabaseClient()
    return _db


def get_agent():
    global _agent
    if _agent is None:
        from chat.agent_web import AeronauticalAgentWeb
        _agent = AeronauticalAgentWeb()
    return _agent


def rebuild_agent():
    global _agent
    _agent = None
    return get_agent()


# ── Models ─────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class SaveChunksRequest(BaseModel):
    chunks: list
    semantic_info: dict


class ApplyModelRequest(BaseModel):
    model_id: str
    model_name: str = ""
    temperature: float = 0.2
    max_tokens: Optional[int] = None
    top_k: Optional[int] = None
    relevance_threshold: Optional[float] = None
    system_prompt: Optional[str] = None


class ExtractAircraftRequest(BaseModel):
    chunks_text: str
    document_code: str = ""


class SaveAeronavesRequest(BaseModel):
    variants: list


# ── Security helpers ────────────────────────────────────────────────────────

def _http_error(status_code: int, safe_msg: str, exc: Exception = None) -> HTTPException:
    """Return a sanitized HTTP error. Logs full detail, hides internals in production."""
    if exc:
        traceback.print_exc()
        print(f"[ERROR] {safe_msg}: {exc}")
    if settings.PRODUCTION:
        return HTTPException(status_code=status_code, detail=safe_msg)
    return HTTPException(status_code=status_code, detail=str(exc) if exc else safe_msg)

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB

def _validate_pdf_upload(filename: str, content: bytes) -> str:
    """Validate uploaded file is a real PDF under size limit. Returns sanitized filename."""
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum 50 MB.")
    if not content[:5] == b"%PDF-":
        raise HTTPException(status_code=415, detail="Only PDF files are accepted.")
    # Sanitize filename
    safe_name = Path(filename).name
    safe_name = re.sub(r"[^\w\-. ]", "_", safe_name)
    if not safe_name.lower().endswith(".pdf"):
        safe_name += ".pdf"
    return safe_name[:255]


# ── Health ─────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "RAG Aeronatic Final FastAPI"}


# ── Auth ────────────────────────────────────────────────────────────────────

@app.post("/api/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    from api.auth import verify_password, create_access_token
    if form_data.username != settings.ADMIN_USERNAME:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not settings.ADMIN_PASSWORD_HASH:
        raise HTTPException(status_code=500, detail="Auth not configured")
    if not verify_password(form_data.password, settings.ADMIN_PASSWORD_HASH):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": form_data.username})
    return {"access_token": token, "token_type": "bearer"}


# ── Dashboard ──────────────────────────────────────────────────────

@app.get("/api/dashboard")
async def get_dashboard():
    try:
        db = get_db()
        stats = db.get_stats()
        return {
            "documents": stats.get("total_chunks", 0),
            "uniqueDocuments": stats.get("unique_documents", 0),
            "pythonService": "Online",
            "server": "Online",
        }
    except Exception as e:
        return {
            "documents": "—",
            "pythonService": "Online",
            "server": "Online",
            "error": str(e),
        }


# ── Chat ───────────────────────────────────────────────────────────

@app.post("/api/chat")
@limiter.limit("30/minute")
async def chat_endpoint(request: Request, req: ChatRequest):
    try:
        agent = get_agent()
        response = agent.query(req.question)

        # Sources are already dicts from agent._process_single_question
        sources = []
        for src in response.sources:
            if isinstance(src, dict):
                sources.append({
                    "code": src.get("code", "Unknown"),
                    "section": src.get("section", "N/A"),
                    "topic": src.get("topic", "N/A"),
                    "score": src.get("score", 0),
                    "content": (src.get("content", "") or "")[:3000],
                    "page_number": src.get("page_number"),
                    "page_capture_url": src.get("page_capture_url"),
                    "image_urls": src.get("image_urls", []),
                    "source": src.get("source", src.get("code", "Unknown")),
                })
            else:
                meta = getattr(src, "metadata", {})
                sources.append({
                    "code": meta.get("official_code", "Unknown"),
                    "section": meta.get("section_id", "N/A"),
                    "topic": meta.get("section_title", "N/A"),
                    "score": round(float(getattr(src, "similarity", 0)), 4),
                    "content": (getattr(src, "content", "") or "")[:3000],
                    "source": meta.get("official_code", "Unknown"),
                })

        trace = getattr(response, 'reasoning_trace', None) or []
        tokens = getattr(response, 'tokens_used', 0) or 0
        print(f"[DEBUG] reasoning_trace={len(trace)} steps, tokens_used={tokens}")

        return {
            "answer": response.answer,
            "sources": sources,
            "success": response.success,
            "reasoning_trace": trace,
            "tokens_used": tokens,
        }
    except Exception as e:
        raise _http_error(500, "Internal server error", e)


# ── Documents ──────────────────────────────────────────────────────

@app.get("/api/documents")
async def get_documents():
    try:
        db = get_db()
        docs = db.get_unique_documents()
        return {
            "documents": [
                {
                    "code": d["code"],
                    "title": d.get("title", ""),
                    "agency": d.get("agency", ""),
                    "doc_type": d.get("doc_type", ""),
                    "chunk_count": d.get("chunks", 0),
                }
                for d in docs
            ]
        }
    except Exception as e:
        raise _http_error(500, "Internal server error", e)


@app.get("/api/documents/{code}/chunks")
async def get_document_chunks(code: str):
    try:
        from database.supabase_client import _rest, TABLE
        rows = _rest("GET", f"/rest/v1/{TABLE}", params={
            "select": "id,content,metadata",
            "metadata->>official_code": f"eq.{code}",
            "limit": "500",
            "order": "id.asc",
        })

        chunks = []
        for row in (rows or []):
            meta = row.get("metadata", {}) or {}
            content = row.get("content", "")
            chunks.append({
                "id": row.get("id"),
                "content": content,
                "section_id": meta.get("section_id", ""),
                "chapter": meta.get("chapter", meta.get("section_title", "")),
                "topic": meta.get("section_title", ""),
                "page_number": meta.get("page_number"),
                "char_count": len(content),
                "has_image": meta.get("has_image", False),
                "page_capture_url": meta.get("page_capture_url"),
                "image_urls": meta.get("image_urls", []),
                "metadata": {k: v for k, v in meta.items()
                             if k not in ("embedding", "search_text") and not isinstance(v, (list, dict))},
            })

        return {"chunks": chunks}
    except Exception as e:
        raise _http_error(500, "Internal server error", e)


# ── Ingest ─────────────────────────────────────────────────────────

@app.post("/api/ingest/analyze")
@limiter.limit("5/5minutes")
async def ingest_analyze(request: Request, file: UploadFile = File(...)):
    try:
        import tempfile
        from core.document_analyzer import DocumentAnalyzer
        from core.classifier import AeronauticalClassifier

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            file.filename = _validate_pdf_upload(file.filename, content)
            tmp.write(content)
            tmp_path = tmp.name

        analyzer = DocumentAnalyzer()
        doc_info = analyzer.analyze(tmp_path)

        classifier = AeronauticalClassifier()
        classification = classifier.classify(file.filename)

        os.unlink(tmp_path)

        return {
            "doc_info": {
                "file_name": file.filename,
                "num_pages": getattr(doc_info, "num_pages", 0),
                "file_size_mb": round(len(content) / (1024 * 1024), 2),
                "has_images": getattr(doc_info, "has_images", False),
            },
            "classification": {
                "agency": getattr(classification, "agency", "Unknown"),
                "doc_type": getattr(classification, "doc_type", "Unknown"),
                "standard_code": getattr(classification, "official_code",
                                         getattr(classification, "standard_code", "Unknown")),
            },
            "estimated_cost": "0.10",
        }
    except Exception as e:
        raise _http_error(500, "Internal server error", e)


@app.post("/api/ingest/process")
@limiter.limit("5/5minutes")
async def ingest_process(request: Request, file: UploadFile = File(...)):
    try:
        import tempfile
        import fitz
        from core.document_analyzer import DocumentAnalyzer
        from core.classifier import AeronauticalClassifier
        from core.pdf_converter import PDFConverter
        from core.ocr_processor import MistralOCRProcessor
        from core.semantic_chunker import SemanticChunker

        logs = ["[>] Starting Document Processing..."]

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            file.filename = _validate_pdf_upload(file.filename, content)
            tmp.write(content)
            tmp_path = tmp.name

        # Analyze
        analyzer = DocumentAnalyzer()
        doc_info = analyzer.analyze(tmp_path)
        num_pages = getattr(doc_info, "num_pages", 0)
        logs.append(f"[OK] Analysis: {num_pages} pages")

        # Classify
        classifier = AeronauticalClassifier()
        classification = classifier.classify(file.filename)
        agency = getattr(classification, "agency", "Unknown")
        official_code = getattr(classification, "official_code",
                                getattr(classification, "standard_code", "Unknown"))
        logs.append(f"[OK] Classification: {agency} - {official_code}")

        # Check actual page count via fitz if doc_info didn't provide it
        if not num_pages:
            try:
                with fitz.open(tmp_path) as _doc:
                    num_pages = len(_doc)
            except Exception:
                num_pages = 0

        def _chunks_to_dicts(raw_chunks):
            result = []
            for i, chunk in enumerate(raw_chunks):
                if isinstance(chunk, dict):
                    c = chunk
                else:
                    c = {
                        "content": getattr(chunk, "content", str(chunk)),
                        "section_id": getattr(chunk, "section_id", f"chunk_{i+1}"),
                        "section_title": getattr(chunk, "section_title", ""),
                        "char_count": len(getattr(chunk, "content", str(chunk))),
                        "has_image": getattr(chunk, "has_image", False),
                        "metadata": getattr(chunk, "metadata", {}),
                    }
                if "char_count" not in c:
                    c["char_count"] = len(c.get("content", ""))
                result.append(c)
            return result

        chunks_list = []
        semantic_info_final = None

        if num_pages > 50:
            # ── BATCH MODE ────────────────────────────────────────────────
            from core.pdf_utils import split_pdf, cleanup_parts

            parts = split_pdf(tmp_path, chunk_size=50)
            logs.append(f"[DOC] Large document ({num_pages} pages) -> {len(parts)} batches of 50")

            all_chunks = []
            global_semantic_info = None

            for idx, part_path in enumerate(parts):
                batch_num = idx + 1
                logs.append(f"[>] Batch {batch_num}/{len(parts)}: OCR...")

                try:
                    ocr = MistralOCRProcessor()
                    # chunk_size > 50 so MistralOCRProcessor won't re-split this part
                    ocr_result = ocr.process_pdf(part_path, chunk_size=51)
                except Exception as ocr_err:
                    logs.append(f"[WARN] Batch {batch_num} OCR failed: {ocr_err}")
                    continue

                if not ocr_result.success:
                    logs.append(f"[WARN] Batch {batch_num} OCR unsuccessful, skipping")
                    continue

                batch_text = ocr_result.full_markdown
                if len(batch_text.strip()) < 100:
                    logs.append(f"[WARN] Batch {batch_num} too little text, skipping")
                    continue

                logs.append(f"  Text: {len(batch_text)} chars. Chunking...")

                try:
                    chunker = SemanticChunker()
                    chunk_res = chunker.chunk_document(
                        batch_text,
                        filename=file.filename if idx == 0 else "",
                    )
                except Exception as chunk_err:
                    logs.append(f"[WARN] Batch {batch_num} chunking failed: {chunk_err}")
                    continue

                if not chunk_res.success:
                    logs.append(f"[WARN] Batch {batch_num} chunking unsuccessful, skipping")
                    continue

                if (
                    global_semantic_info is None
                    and getattr(chunk_res, "agency", None)
                    and chunk_res.agency != "Unknown"
                ):
                    global_semantic_info = {
                        "official_code": chunk_res.official_code,
                        "agency": chunk_res.agency,
                        "doc_type": chunk_res.document_type,
                        "document_title": chunk_res.title,
                    }

                all_chunks.extend(_chunks_to_dicts(chunk_res.chunks))
                logs.append(f"  [OK] Batch {batch_num}: {len(chunk_res.chunks)} chunks")

            cleanup_parts(parts)

            chunks_list = all_chunks
            semantic_info_final = global_semantic_info or {
                "official_code": official_code,
                "agency": agency,
                "doc_type": getattr(classification, "doc_type", "Unknown"),
                "document_title": file.filename or "",
            }

        else:
            # ── SMALL DOCUMENT (≤ 50 pages) ───────────────────────────────
            logs.append("[>] Extracting text...")
            converter = PDFConverter()
            text_result = converter.convert_to_markdown(tmp_path)
            full_text = text_result.full_markdown if text_result.success else ""

            if not full_text or len(full_text.strip()) < 100:
                logs.append("[WARN] Low text yield, trying OCR...")
                try:
                    ocr = MistralOCRProcessor()
                    ocr_result = ocr.process_pdf(tmp_path)
                    full_text = ocr_result.full_markdown if ocr_result.success else ""
                    logs.append(f"[OK] OCR: {len(full_text)} chars extracted")
                except Exception as ocr_err:
                    logs.append(f"[WARN] OCR failed: {ocr_err}")

            logs.append(f"[OK] Text extracted: {len(full_text)} characters")

            logs.append("[>] Semantic chunking...")
            chunker = SemanticChunker()
            chunks_result = chunker.chunk_document(full_text, filename=file.filename or "")

            chunks_list = _chunks_to_dicts(chunks_result.chunks if chunks_result.success else [])

            semantic_info_final = {
                "official_code": chunks_result.official_code or official_code,
                "agency": chunks_result.agency or agency,
                "doc_type": chunks_result.document_type or getattr(classification, "doc_type", "Unknown"),
                "document_title": chunks_result.title or file.filename or "",
            }

        logs.append(f"[OK] Chunking complete: {len(chunks_list)} chunks")
        logs.append("[*] PROCESSING COMPLETE -- Review chunks before indexing")

        os.unlink(tmp_path)

        return {
            "doc_info": {
                "file_name": file.filename,
                "num_pages": num_pages,
                "file_size_mb": round(len(content) / (1024 * 1024), 2),
            },
            "classification": {
                "agency": agency,
                "doc_type": getattr(classification, "doc_type", "Unknown"),
                "standard_code": official_code,
            },
            "estimated_cost": "0.10",
            "chunks": chunks_list,
            "semantic_info": semantic_info_final,
            "logs": logs,
        }
    except Exception as e:
        raise _http_error(500, "Internal server error", e)


@app.post("/api/ingest/save")
@limiter.limit("5/5minutes")
async def ingest_save(request: Request, req: SaveChunksRequest):
    try:
        from core.embeddings import EmbeddingsGenerator

        logs = ["[>] Starting embedding generation..."]
        embedder = EmbeddingsGenerator()
        db = get_db()

        texts = [c.get("content", "") for c in req.chunks]
        logs.append(f"[>] Generating embeddings for {len(texts)} chunks...")

        embeddings = embedder.generate_batch(texts)
        logs.append(f"[OK] Generated {len(embeddings)} embeddings")

        official_code = req.semantic_info.get("official_code", "")

        # Deduplicate: remove any existing chunks for this document before insert
        if official_code:
            deleted = db.delete_document_by_code(official_code)
            logs.append(f"[>] Removed {deleted} existing chunks for '{official_code}' (deduplication)")

        documents = []
        for chunk in req.chunks:
            meta = chunk.get("metadata", {})
            meta.update({
                "official_code": official_code,
                "agency": req.semantic_info.get("agency", ""),
                "doc_type": req.semantic_info.get("doc_type", ""),
                "document_title": req.semantic_info.get("document_title", ""),
                "section_id": chunk.get("section_id", ""),
                "section_title": chunk.get("section_title", ""),
                "has_image": chunk.get("has_image", False),
                "chunk_id": f"{official_code}_{chunk.get('section_id', '')}".replace(" ", "_").replace("/", "_"),
                "section_path": _build_section_path(chunk),
                "search_text": _normalize_search_text(chunk.get("content", "")),
            })
            documents.append({
                "content": chunk.get("content", ""),
                "metadata": meta,
            })

        logs.append("[>] Saving to Supabase...")
        result = db.insert_documents_batch(documents, embeddings)
        saved = result.get("successful", 0)
        total = result.get("total", 0)
        logs.append(f"[OK] Saved {saved}/{total} chunks")

        if result.get("errors"):
            for err_msg in result["errors"]:
                logs.append(f"[ERROR] {err_msg}")

        if result.get("failed", 0) > 0:
            logs.append(f"[WARN] Failed: {result['failed']} chunks")

        # If nothing was saved, report as error so the frontend knows
        if saved == 0 and total > 0:
            logs.append("[X] No chunks were saved to Supabase. Check DB permissions and RLS policies.")
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "No chunks were saved to the database",
                    "result": result,
                    "logs": logs,
                },
            )

        return {
            "message": f"Indexed {saved} chunks successfully",
            "result": result,
            "logs": logs,
        }
    except Exception as e:
        raise _http_error(500, "Internal server error", e)


# ── Extracción de aeronaves desde TCDS ────────────────────────────

# Prompt de extracción de datos estructurados de aeronaves desde TCDS
# Prompt de extraccion de datos de aeronaves desde TCDS.
# IMPORTANTE: El tcds_code y tcds_code_short son CRITICOS para la identificacion
# de proyectos en la organizacion DOA. El codigo corto (ej: "A.089") se usa como
# prefijo de proyecto, por eso se enfatiza tanto en el prompt.
_AIRCRAFT_EXTRACTION_PROMPT = """You are an expert aviation data analyst specializing in EASA/FAA Type Certificate Data Sheets (TCDS).

Your task: extract ALL aircraft model variants from the TCDS text below into structured JSON.

CRITICAL INSTRUCTIONS:
1. **TCDS CODE IS THE MOST IMPORTANT FIELD** — You MUST extract:
   - "tcds_code": The FULL EASA TCDS reference number (e.g., "EASA.A.089", "EASA.A.064", "EASA.IM.A.196").
     Look for it on the cover page or header — it typically starts with "EASA." followed by a letter code and number.
   - "tcds_code_short": The SHORT version WITHOUT the "EASA." prefix (e.g., "A.089", "A.064", "IM.A.196").
     This is CRITICAL because it is used as the project identifier in the DOA organization.
   If you cannot find the code, still fill in the field with your best guess from the document context. NEVER leave these empty.
2. Extract EVERY model/variant listed in the TCDS (e.g., PC-12, PC-12/45, PC-12/47, PC-12/47E are SEPARATE variants).
3. For each variant, fill in ALL fields. If a value is not found, use empty string "" for text fields and null for numeric fields.
4. MTOW and MLW must be in kg. If the document lists values in lbs, convert using 1 lb = 0.453592 kg. Round to nearest integer.
5. The certification basis (regulacion_base) is CRITICAL — extract it precisely (e.g., "CS-23 Amendment 5", "FAR 23", "CS-25", "14 CFR Part 23").
6. Extract eligible serial numbers (MSN) per variant if listed.
7. The "categoria" field should be one of: Normal, Commuter, Transport, Utility, Aerobatic, or as stated in the TCDS.
8. If the TCDS covers multiple type designations (e.g., a family), list each model as a separate variant.
9. ALL variants from the SAME TCDS document share the SAME tcds_code and tcds_code_short values.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "variants": [
    {
      "tcds_code": "EASA.A.XXX (MANDATORY — full TCDS reference code, e.g. EASA.A.089)",
      "tcds_code_short": "A.XXX (MANDATORY — short code for project ID, e.g. A.089)",
      "tcds_issue": "Issue XX (issue/revision number)",
      "tcds_date": "DD Month YYYY (date of this TCDS issue)",
      "fabricante": "Manufacturer full legal name",
      "pais": "Country of manufacturer",
      "tipo": "Type designation (e.g., PC-12)",
      "modelo": "Specific model/variant (e.g., PC-12/47E)",
      "msn_elegibles": "Eligible serial numbers or range",
      "motor": "Engine type designation",
      "mtow_kg": 0,
      "mlw_kg": 0,
      "regulacion_base": "Certification basis (CS-23, FAR 23, etc.)",
      "categoria": "Normal/Commuter/Transport/Utility/Aerobatic",
      "notas": "Any important notes about this variant"
    }
  ]
}

TCDS TEXT:
"""


def _get_openai_client():
    """
    Devuelve un cliente OpenAI configurado.
    Prioridad: OpenAI directo > OpenRouter.
    """
    from openai import OpenAI

    if settings.OPENAI_API_KEY:
        return OpenAI(api_key=settings.OPENAI_API_KEY), "gpt-4o"
    elif settings.OPENROUTER_API_KEY:
        return OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.OPENROUTER_API_KEY,
        ), "openai/gpt-4o"
    else:
        return None, None


@app.post("/api/extract/aircraft")
async def extract_aircraft(req: ExtractAircraftRequest):
    """
    Extrae datos estructurados de aeronaves desde el texto de un TCDS.
    Envía el texto a un modelo AI y devuelve las variantes extraídas.
    """
    try:
        if not req.chunks_text or len(req.chunks_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="El texto proporcionado es demasiado corto para extraer datos.")

        client, model = _get_openai_client()
        if client is None:
            raise HTTPException(
                status_code=503,
                detail="No hay API key configurada (OPENAI_API_KEY o OPENROUTER_API_KEY).",
            )

        # Limitar texto para no exceder el contexto del modelo (~120K chars ≈ 30K tokens)
        max_chars = 120000
        text_to_send = req.chunks_text[:max_chars]

        prompt = _AIRCRAFT_EXTRACTION_PROMPT + text_to_send

        # Si se proporcionó document_code, incluirlo como contexto adicional
        if req.document_code:
            prompt += f"\n\nNOTE: The TCDS document code is: {req.document_code}"

        print(f"[EXTRACT] Enviando {len(text_to_send)} chars al modelo {model} para extracción de aeronaves...")

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a structured data extraction assistant. Return ONLY valid JSON, no markdown fences, no explanations.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            max_tokens=4096,
        )

        raw_answer = response.choices[0].message.content.strip()

        # Limpiar posibles markdown fences (```json ... ```)
        if raw_answer.startswith("```"):
            # Quitar primera línea (```json) y última (```)
            lines = raw_answer.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_answer = "\n".join(lines)

        # Parsear JSON
        try:
            extracted = json.loads(raw_answer)
        except json.JSONDecodeError as je:
            print(f"[EXTRACT][ERROR] JSON inválido del modelo: {raw_answer[:500]}")
            raise HTTPException(
                status_code=502,
                detail=f"El modelo devolvió JSON inválido: {str(je)}",
            )

        variants = extracted.get("variants", [])
        print(f"[EXTRACT] Extraídas {len(variants)} variantes de aeronaves")

        # Tokens usados (si disponible)
        tokens_used = 0
        if hasattr(response, "usage") and response.usage:
            tokens_used = response.usage.total_tokens or 0

        return {
            "success": True,
            "variants": variants,
            "variants_count": len(variants),
            "model_used": model,
            "tokens_used": tokens_used,
            "text_length": len(text_to_send),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise _http_error(500, "Error extrayendo datos de aeronaves", e)


@app.post("/api/extract/aircraft/save")
async def save_aircraft_variants(req: SaveAeronavesRequest):
    """
    Guarda las variantes de aeronave aprobadas en la tabla doa_aeronaves de Supabase.
    """
    try:
        if not req.variants:
            raise HTTPException(status_code=400, detail="No se proporcionaron variantes para guardar.")

        db = get_db()
        result = db.insert_aeronaves(req.variants)

        saved = result.get("saved", 0)
        errors = result.get("errors", [])

        if saved == 0 and errors:
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "No se guardó ninguna variante",
                    "errors": errors,
                },
            )

        return {
            "success": True,
            "message": f"Guardadas {saved} variantes de aeronave correctamente",
            "saved": saved,
            "errors": errors,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise _http_error(500, "Error guardando variantes de aeronave", e)


# ── Settings ───────────────────────────────────────────────────────

@app.get("/api/settings")
async def get_settings():
    validation = settings.validate()
    return {
        "python": {"ok": True, "version": sys.version.split()[0]},
        "capabilities": {
            "documents": bool(settings.SUPABASE_URL and settings.SUPABASE_KEY),
            "chat": bool(settings.OPENROUTER_API_KEY or settings.ANTHROPIC_API_KEY or settings.OPENAI_API_KEY),
            "ocr": bool(settings.MISTRAL_API_KEY),
            "embeddings": bool(settings.GOOGLE_API_KEY),
            "reranking": bool(settings.COHERE_API_KEY),
        },
        "credentials": validation,
    }


# ── Models ─────────────────────────────────────────────────────────

@app.get("/api/models")
async def get_models():
    try:
        import httpx
        key = settings.OPENROUTER_API_KEY
        if not key:
            return {"models": [], "active": _load_model_config()}

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {key}"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

        models = []
        for m in data.get("data", []):
            models.append({
                "id": m["id"],
                "name": m.get("name", m["id"]),
                "contextLength": m.get("context_length"),
                "promptPrice": m.get("pricing", {}).get("prompt"),
            })

        return {"models": models, "active": _load_model_config()}
    except Exception as e:
        return {"models": [], "active": _load_model_config(), "error": str(e)}


@app.get("/api/models/active")
async def get_active_model():
    return _load_model_config()


@app.post("/api/models/apply")
async def apply_model(req: ApplyModelRequest):
    # Start from existing config so we don't wipe fields not sent in this request
    cfg = _load_model_config()
    cfg["id"] = req.model_id
    cfg["name"] = req.model_name
    cfg["temperature"] = req.temperature
    if req.max_tokens is not None:
        cfg["max_tokens"] = req.max_tokens
    if req.top_k is not None:
        cfg["top_k"] = req.top_k
    if req.relevance_threshold is not None:
        cfg["relevance_threshold"] = req.relevance_threshold
    if req.system_prompt is not None:
        cfg["system_prompt"] = req.system_prompt
    _save_model_config(cfg)
    rebuild_agent()
    return {"active": cfg, "message": f"Model applied: {req.model_id}"}


# ── Chat History ───────────────────────────────────────────────────

HISTORY_PATH = _DATA_DIR / "chat_history.json"


def _load_history() -> list:
    if HISTORY_PATH.exists():
        with open(HISTORY_PATH) as f:
            return json.load(f)
    return []


def _save_history(data: list):
    with open(HISTORY_PATH, "w") as f:
        json.dump(data, f, indent=2, default=str)


@app.get("/api/chat/history")
async def get_chat_history():
    return _load_history()


@app.get("/api/chat/stats")
async def get_chat_stats():
    history = _load_history()
    total_msgs = sum(len(s.get("messages", [])) for s in history)
    return {"sessions": len(history), "messages": total_msgs}


@app.delete("/api/chat/history")
async def delete_chat_history():
    _save_history([])
    return {"message": "History cleared"}


@app.delete("/api/chat/history/{session_id}")
async def delete_chat_session(session_id: str):
    history = _load_history()
    history = [s for s in history if s.get("id") != session_id]
    _save_history(history)
    return {"message": "Session deleted"}


# ── Assets ─────────────────────────────────────────────────────────

@app.get("/api/assets/{kind}/{filename:path}")
async def serve_asset(kind: str, filename: str):
    allowed_kinds = {"images": settings.LOCAL_IMAGES_DIR, "captures": settings.LOCAL_CAPTURES_DIR}
    if kind not in allowed_kinds:
        raise HTTPException(status_code=404, detail="Not found")
    # Path traversal protection
    base_dir = Path(allowed_kinds[kind]).resolve()
    candidate = (base_dir / filename).resolve()
    if not str(candidate).startswith(str(base_dir)):
        raise HTTPException(status_code=403, detail="Forbidden")
    if not candidate.exists():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(candidate)


# Isolated backend copy: legacy SPA serving is disabled here.

# Isolated backend copy: do not serve the legacy React SPA here.


# ── Run ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002, reload=True)
