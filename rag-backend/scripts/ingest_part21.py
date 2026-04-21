"""
Ingest AMC-GM Part-21 Issue 2 PDF into Supabase doa_part21_embeddings table.

Chunks the document by logical sections with rich metadata,
generates embeddings via OpenAI text-embedding-3-large,
and stores everything in Supabase with pgvector.

Usage:
    python ingest_part21.py <path_to_pdf>
    python ingest_part21.py  (uses default path)
"""

import json
import os
import re
import sys
import time
from dataclasses import dataclass, field

import fitz  # pymupdf
from openai import OpenAI
from supabase import create_client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DEFAULT_PDF = (
    r"C:\Users\Jesús Andrés\Desktop"
    r"\Annex to ED Decision (AMC-GM Part-21 - Issue 2 .pdf"
)

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL",
    "https://gterzsoapepzozgqbljk.supabase.co",
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
)
OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")

EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_DIM = 3072
TABLE = "doa_part21_embeddings"
BATCH_SIZE = 20  # embeddings per API call
MAX_CHUNK_CHARS = 2000  # soft limit per chunk


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------
@dataclass
class Chunk:
    content: str
    metadata: dict = field(default_factory=dict)
    parent_id: str = ""


# ---------------------------------------------------------------------------
# PDF extraction
# ---------------------------------------------------------------------------
def extract_pages(pdf_path: str) -> list[dict]:
    """Extract text and page number from each page."""
    doc = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text()
        pages.append({"page": i + 1, "text": text})
    doc.close()
    return pages


# ---------------------------------------------------------------------------
# Section detection
# ---------------------------------------------------------------------------
# Matches patterns like "3.6.1", "A.1.2", "J.12", "3.6.3.1"
SECTION_RE = re.compile(
    r"^(\d+\.\d+(?:\.\d+)*(?:\.\d+)?|[A-Z]\.\d+(?:\.\d+)*)\s+"
)

# Matches chapter headings like "3. PROCESS FOR ESTABLISHING..."
CHAPTER_RE = re.compile(r"^(\d+)\.\s+([A-Z][A-Z\s,.()/-]{10,})$", re.MULTILINE)

# Matches Appendix headings
APPENDIX_RE = re.compile(r"^APPENDIX\s+([A-Z])\.\s+(.+)$", re.MULTILINE)

# Matches table headers like "Table A-2."
TABLE_RE = re.compile(r"Table\s+([A-Z]-\d+)\.\s+(.+?)(?:\s*\(continued\))?$")


def detect_chapter(text: str) -> str | None:
    """Detect if text contains a chapter heading."""
    m = CHAPTER_RE.search(text)
    if m:
        return m.group(1)
    m = APPENDIX_RE.search(text)
    if m:
        return f"Appendix_{m.group(1)}"
    return None


def detect_section(line: str) -> str | None:
    """Detect section number from a line."""
    stripped = line.strip()
    m = SECTION_RE.match(stripped)
    if m:
        return m.group(1)
    return None


def detect_category_from_text(text: str) -> str:
    """Infer aircraft category from surrounding text."""
    lower = text.lower()
    if "cs-23" in lower or "small aeroplane" in lower:
        return "CS-23"
    if "cs-25" in lower or "large aeroplane" in lower or "transport aeroplane" in lower:
        return "CS-25"
    if "cs-29" in lower:
        return "CS-29"
    if "cs-27" in lower or "rotorcraft" in lower:
        return "CS-27"
    if "engine" in lower and ("cs-e" in lower or "propulsion" in lower):
        return "engines"
    if "propeller" in lower:
        return "propellers"
    return "general"


def detect_classification_from_text(text: str) -> str:
    """Infer classification type from text context."""
    lower = text.lower()
    if "not significant" in lower or "not_significant" in lower:
        return "not_significant"
    if "significant" in lower:
        return "significant"
    if "minor" in lower and "major" in lower:
        return "classification_criteria"
    if "major" in lower:
        return "major"
    if "minor" in lower:
        return "minor"
    return "guidance"


def detect_content_type(text: str, section: str) -> str:
    """Infer content type."""
    if TABLE_RE.search(text):
        return "table_entry"
    if section.startswith("A."):
        return "example"
    if section.startswith("J."):
        return "definition"
    if "step" in text.lower()[:100]:
        return "process_step"
    if any(
        w in text.lower()[:200]
        for w in ["criterion", "criteria", "21.a.101(b)(1)", "21.a.91"]
    ):
        return "criteria"
    return "guidance"


# ---------------------------------------------------------------------------
# Chunking strategy
# ---------------------------------------------------------------------------
def chunk_pages(pages: list[dict]) -> list[Chunk]:
    """
    Split the PDF into semantic chunks.

    Strategy:
    - Group consecutive lines into sections based on section numbering
    - Each section becomes a chunk (split if too long)
    - Appendix A table examples get individual chunks with rich metadata
    - Track chapter and section context throughout
    """
    chunks: list[Chunk] = []
    current_chapter = "1"
    current_section = ""
    current_section_title = ""
    current_table = ""
    current_category = "general"
    buffer_lines: list[str] = []
    buffer_page_start = 1

    def flush_buffer():
        nonlocal buffer_lines, buffer_page_start
        if not buffer_lines:
            return

        text = "\n".join(buffer_lines).strip()
        if not text or len(text) < 30:
            buffer_lines = []
            return

        # Remove boilerplate headers/footers
        text = re.sub(
            r"TE\.RPRO\.\d+-\d+.*?An agency of the European Union\s*",
            "",
            text,
            flags=re.DOTALL,
        )
        text = re.sub(r"Page \d+ of \d+\s*", "", text)
        text = text.strip()

        if not text or len(text) < 30:
            buffer_lines = []
            return

        # Split if too long
        sub_chunks = split_text(text, MAX_CHUNK_CHARS)

        for i, sub in enumerate(sub_chunks):
            chunk_id = (
                f"part21_{current_chapter}_{current_section}_{buffer_page_start}"
            )
            if len(sub_chunks) > 1:
                chunk_id += f"_p{i}"

            classification = detect_classification_from_text(sub)
            content_type = detect_content_type(sub, current_section)

            # Build search text
            search_parts = [
                current_section,
                current_section_title,
                current_category,
                classification,
            ]
            search_text = " ".join(filter(None, search_parts))

            chunks.append(
                Chunk(
                    content=sub,
                    metadata={
                        "chunk_id": chunk_id,
                        "document_title": "AMC-GM Part-21 Issue 2",
                        "document_code": "AMC-GM-Part21-Issue2",
                        "chapter": current_chapter,
                        "section": current_section,
                        "section_title": current_section_title[:200] if current_section_title else "",
                        "category": current_category,
                        "classification": classification,
                        "content_type": content_type,
                        "page_start": buffer_page_start,
                        "search_text": search_text,
                    },
                    parent_id=f"AMC-GM-Part21-Issue2_{current_chapter}",
                )
            )

        buffer_lines = []

    for page_data in pages:
        page_num = page_data["page"]
        text = page_data["text"]
        lines = text.split("\n")

        # Detect chapter
        ch = detect_chapter(text)
        if ch:
            current_chapter = ch

        # Detect category from page context
        cat = detect_category_from_text(text)
        if cat != "general":
            current_category = cat

        # Detect table
        for line in lines:
            tm = TABLE_RE.search(line.strip())
            if tm:
                current_table = tm.group(1)

        for line in lines:
            stripped = line.strip()

            # Skip boilerplate
            if any(
                bp in stripped
                for bp in [
                    "TE.RPRO.",
                    "European Aviation Safety Agency",
                    "ISO 9001",
                    "Proprietary document",
                    "An agency of the European",
                    "Page " ,
                ]
            ):
                continue

            # Detect new section
            sec = detect_section(stripped)
            if sec:
                flush_buffer()
                current_section = sec
                # Extract title (rest of line after section number)
                title_match = SECTION_RE.match(stripped)
                if title_match:
                    current_section_title = stripped[title_match.end() :].strip()
                buffer_page_start = page_num

            buffer_lines.append(line)

    # Flush remaining
    flush_buffer()

    return chunks


def split_text(text: str, max_chars: int) -> list[str]:
    """Split text into sub-chunks at paragraph boundaries."""
    if len(text) <= max_chars:
        return [text]

    parts = []
    paragraphs = text.split("\n\n")
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 > max_chars and current:
            parts.append(current.strip())
            current = para
        else:
            current = current + "\n\n" + para if current else para

    if current.strip():
        parts.append(current.strip())

    # If any part is still too long, hard-split
    final = []
    for part in parts:
        if len(part) <= max_chars:
            final.append(part)
        else:
            for i in range(0, len(part), max_chars):
                final.append(part[i : i + max_chars])

    return final


# ---------------------------------------------------------------------------
# Also ingest G12-01 questions as dedicated chunks
# ---------------------------------------------------------------------------
G12_01_QUESTIONS = [
    {
        "number": 1,
        "question": "Is there a Change to the General Configuration (see 21A.101(b)(1)(i) for details)?",
        "group": "critical",
        "note": "If YES, stop classifying. The Head of Airworthiness must contact EASA for change classification.",
    },
    {
        "number": 2,
        "question": "Is there a Change to the principles of construction (see 21A.101(b)(1)(i) for details)?",
        "group": "critical",
        "note": "If YES, stop classifying. The Head of Airworthiness must contact EASA for change classification.",
    },
    {
        "number": 3,
        "question": "Have the assumptions used for Certification been invalidated (see 21A.101(b)(1)(ii) for details)?",
        "group": "critical",
        "note": "If YES, stop classifying. The Head of Airworthiness must contact EASA for change classification.",
    },
    {
        "number": 4,
        "question": "Do the changes or repairs have appreciable effect on weight?",
        "group": "standard",
        "note": (
            "Consider the location (STA/estación) of the change. "
            "Indicate STA position if known (e.g. STA 100, STA 250). "
            "Weight added far from the CG (centre of gravity) has greater impact on balance. "
            "Even small mass additions at extreme forward/aft stations can shift the CG envelope."
        ),
    },
    {
        "number": 5,
        "question": "Do the changes or repairs have appreciable effect on balance?",
        "group": "standard",
        "note": (
            "Specify the STA (estación) location of the added/removed mass. "
            "Provide arm distance from datum if available. "
            "Evaluate moment change: ΔMoment = ΔWeight × arm (distance from datum). "
            "Check if the CG remains within the approved envelope for all loading conditions."
        ),
    },
    {
        "number": 6,
        "question": "Do the changes or repairs have appreciable effect on structural strength?",
        "group": "standard",
    },
    {
        "number": 7,
        "question": "Do the changes or repairs have appreciable effect on reliability?",
        "group": "standard",
    },
    {
        "number": 8,
        "question": "Do the changes or repairs have appreciable effect on operational characteristics of the product?",
        "group": "standard",
    },
    {
        "number": 9,
        "question": "Do the changes or repairs require an adjustment of certification basis?",
        "group": "standard",
    },
    {
        "number": 10,
        "question": "Do the changes or repairs require a new interpretation of the requirements used for the TC basis?",
        "group": "standard",
    },
    {
        "number": 11,
        "question": "Do the changes or repairs contain aspects of compliance demonstration not previously accepted?",
        "group": "standard",
    },
    {
        "number": 12,
        "question": "Do the changes or repairs require an extent of new substantiation data and degree of reassessment and re-evaluation considerable?",
        "group": "standard",
    },
    {
        "number": 13,
        "question": "Do the changes or repairs alter the limitations directly approved by the Agency?",
        "group": "standard",
    },
    {
        "number": 14,
        "question": "Are the changes mandated by an Airworthiness Directive or terminating action of an Airworthiness Directive?",
        "group": "standard",
    },
    {
        "number": 15,
        "question": "Do the changes or repair introduce or affect function where failure condition is catastrophic or hazardous?",
        "group": "standard",
    },
    {
        "number": 16,
        "question": "Do the changes affect significantly any other aircraft airworthiness characteristic not mentioned in the above questions?",
        "group": "standard",
    },
]


def build_g12_chunks() -> list[Chunk]:
    """Create dedicated chunks for each G12-01 classification question."""
    chunks = []

    # One chunk with all questions together for context
    all_questions = "G12-01 Change Classification Criteria (DOA Internal Form)\n\n"
    all_questions += "CRITICAL QUESTIONS (if any YES → contact EASA):\n"
    for q in G12_01_QUESTIONS:
        if q["group"] == "critical":
            all_questions += f"  Q{q['number']}: {q['question']}\n"
    all_questions += "\nCLASSIFICATION QUESTIONS (any YES → Major, all NO → Minor):\n"
    for q in G12_01_QUESTIONS:
        if q["group"] == "standard":
            all_questions += f"  Q{q['number']}: {q['question']}\n"
            if "note" in q:
                all_questions += f"    → {q['note']}\n"
    all_questions += "\nNOTE: If any is YES the change or repair is probably major, but still can be minor. Perform further investigation."
    all_questions += "\nNOTE: If the project is reclassified as major (from minor to major), it will be sent to EASA for its approval."

    chunks.append(
        Chunk(
            content=all_questions,
            metadata={
                "chunk_id": "g12_01_all_questions",
                "document_title": "G12-01 Change Classification",
                "document_code": "G12-01",
                "chapter": "classification",
                "section": "all",
                "section_title": "Complete G12-01 Classification Questionnaire",
                "category": "general",
                "classification": "classification_criteria",
                "content_type": "criteria",
                "search_text": "G12-01 major minor classification change criteria appreciable effect",
            },
            parent_id="G12-01",
        )
    )

    # Individual question chunks for precise retrieval
    for q in G12_01_QUESTIONS:
        content = f"G12-01 Question {q['number']} ({q['group'].upper()}):\n"
        content += f"{q['question']}\n"
        if "note" in q:
            content += f"\nNote: {q['note']}"

        chunks.append(
            Chunk(
                content=content,
                metadata={
                    "chunk_id": f"g12_01_q{q['number']}",
                    "document_title": "G12-01 Change Classification",
                    "document_code": "G12-01",
                    "chapter": "classification",
                    "section": f"Q{q['number']}",
                    "section_title": q["question"][:200],
                    "category": "general",
                    "classification": "classification_criteria",
                    "content_type": "criteria",
                    "question_number": q["number"],
                    "question_group": q["group"],
                    "search_text": f"G12-01 Q{q['number']} {q['question']}",
                },
                parent_id="G12-01",
            )
        )

    return chunks


# ---------------------------------------------------------------------------
# Embedding generation
# ---------------------------------------------------------------------------
def generate_embeddings(
    client: OpenAI, texts: list[str]
) -> list[list[float]]:
    """Generate embeddings in batches."""
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )
    return [item.embedding for item in response.data]


# ---------------------------------------------------------------------------
# Supabase insertion
# ---------------------------------------------------------------------------
def insert_chunks(supabase, chunks: list[Chunk], embeddings: list[list[float]]):
    """Insert chunks with embeddings into Supabase."""
    rows = []
    for chunk, embedding in zip(chunks, embeddings):
        rows.append(
            {
                "content": chunk.content,
                "embedding": embedding,
                "metadata": chunk.metadata,
                "parent_id": chunk.parent_id,
            }
        )

    # Insert in batches
    batch_size = 50
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        result = supabase.table(TABLE).insert(batch).execute()
        print(f"  Inserted batch {i // batch_size + 1} ({len(batch)} rows)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF

    # Load env from rag-backend/.env if keys not set
    if not OPENAI_KEY or not SUPABASE_KEY:
        env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
        if os.path.exists(env_path):
            print(f"Loading env from {env_path}")
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, value = line.partition("=")
                        os.environ.setdefault(key.strip(), value.strip())

    openai_key = os.environ.get("OPENAI_API_KEY", OPENAI_KEY)
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY)
    supabase_url = os.environ.get("SUPABASE_URL", SUPABASE_URL)

    if not openai_key:
        print("ERROR: OPENAI_API_KEY not found")
        sys.exit(1)
    if not supabase_key:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY not found")
        sys.exit(1)

    print(f"PDF: {pdf_path}")
    print(f"Supabase: {supabase_url}")
    print(f"Table: {TABLE}")
    print()

    # Step 1: Extract pages
    print("Step 1: Extracting PDF pages...")
    pages = extract_pages(pdf_path)
    print(f"  {len(pages)} pages extracted")

    # Step 2: Chunk
    print("Step 2: Chunking document...")
    chunks = chunk_pages(pages)
    print(f"  {len(chunks)} chunks from PDF")

    # Step 2b: Add G12-01 questions
    g12_chunks = build_g12_chunks()
    chunks.extend(g12_chunks)
    print(f"  {len(g12_chunks)} chunks from G12-01")
    print(f"  {len(chunks)} total chunks")

    # Filter out very small chunks
    chunks = [c for c in chunks if len(c.content.strip()) >= 50]
    print(f"  {len(chunks)} chunks after filtering (>=50 chars)")

    # Step 3: Generate embeddings
    print("Step 3: Generating embeddings...")
    openai_client = OpenAI(api_key=openai_key)

    all_embeddings = []
    texts = [c.content for c in chunks]

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        print(f"  Embedding batch {i // BATCH_SIZE + 1}/{(len(texts) + BATCH_SIZE - 1) // BATCH_SIZE} ({len(batch)} texts)...")
        embeddings = generate_embeddings(openai_client, batch)
        all_embeddings.extend(embeddings)
        time.sleep(0.5)  # Rate limiting

    print(f"  {len(all_embeddings)} embeddings generated")

    # Step 4: Insert into Supabase
    print("Step 4: Inserting into Supabase...")
    supabase = create_client(supabase_url, supabase_key)
    insert_chunks(supabase, chunks, all_embeddings)

    print()
    print(f"Done! {len(chunks)} chunks ingested into {TABLE}")

    # Summary stats
    categories = {}
    content_types = {}
    docs = {}
    for c in chunks:
        cat = c.metadata.get("category", "unknown")
        ct = c.metadata.get("content_type", "unknown")
        doc = c.metadata.get("document_code", "unknown")
        categories[cat] = categories.get(cat, 0) + 1
        content_types[ct] = content_types.get(ct, 0) + 1
        docs[doc] = docs.get(doc, 0) + 1

    print("\nBy document:")
    for k, v in sorted(docs.items()):
        print(f"  {k}: {v}")
    print("\nBy category:")
    for k, v in sorted(categories.items()):
        print(f"  {k}: {v}")
    print("\nBy content type:")
    for k, v in sorted(content_types.items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
