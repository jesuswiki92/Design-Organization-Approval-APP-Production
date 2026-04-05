"""
Text normalization and lightweight keyword extraction.
General-purpose utilities for ingestion quality.
"""

import re
from collections import Counter


_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "shall", "must", "may",
    "not", "are", "from", "into", "over", "under", "within", "between",
    "where", "when", "then", "than", "such", "each", "all", "any", "use",
    "using", "used", "been", "being", "have", "has", "had", "was", "were",
    "can", "could", "would", "should", "will", "also", "only", "per",
    "para", "que", "con", "sin", "del", "las", "los", "por", "como",
    "para", "una", "uno", "unos", "unas", "este", "esta", "estos", "estas",
}


def normalize_text_for_embedding(text: str) -> str:
    """Normalize whitespace for stable embeddings without changing meaning."""
    if not text:
        return ""
    # Normalize newlines
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse repeated spaces
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def normalize_search_text(text: str) -> str:
    """Lowercase and remove noisy characters for exact/keyword search."""
    if not text:
        return ""
    text = text.lower()
    # Keep alphanumerics, dots and dashes (useful for section IDs like 23.2100)
    text = re.sub(r"[^a-z0-9\.\-]+", " ", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def extract_keywords(text: str, max_keywords: int = 12) -> list:
    """Extract simple keywords by frequency."""
    if not text:
        return []
    tokens = re.findall(r"[a-zA-Z0-9][a-zA-Z0-9\./\-]*", text.lower())
    filtered = [
        t for t in tokens
        if len(t) >= 3 and t not in _STOPWORDS
    ]
    if not filtered:
        return []
    counts = Counter(filtered)
    return [w for w, _ in counts.most_common(max_keywords)]


def normalize_section_id(section_id: str) -> str:
    """Normalize section IDs into a consistent format for lookup."""
    if not section_id:
        return ""
    s = section_id.strip()
    # Normalize CS-23 variants: "CS 23.301", "CS-23.301", "23.301"
    m = re.search(r'(?:CS[\s-]*)?23\.(\d{3,4})', s, re.IGNORECASE)
    if m:
        digits = m.group(1)
        return f"cs_23_{digits}"
    # Generic dotted section IDs (e.g., 10.4.1)
    m = re.search(r'\d+(?:\.\d+)+', s)
    if m:
        return m.group(0)
    return s.lower()


def extract_subsection_ids(text: str, max_ids: int = 50) -> list:
    """Extract dotted subsection IDs like 10.4.1 or 23.301(a)."""
    if not text:
        return []
    # Capture patterns like 10.4.1, 23.301, 23.301(a)
    raw = re.findall(r'\b\d+(?:\.\d+)+(?:\([a-z0-9]+\))?', text, re.IGNORECASE)
    # Normalize: strip whitespace and trailing punctuation
    cleaned = []
    for r in raw:
        r = r.strip().rstrip('.,;:')
        if r and r not in cleaned:
            cleaned.append(r)
        if len(cleaned) >= max_ids:
            break
    return cleaned
