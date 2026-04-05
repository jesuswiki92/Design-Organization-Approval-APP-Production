"""
Semantic Chunker V3 usando ChatGPT-5.2 para chunking inteligente.

Estrategia en 2 fases:
  Fase 1 (IA): Analizar estructura del documento → plan de corte (secciones + posiciones).
  Fase 2 (Código): Extraer texto determinísticamente usando el plan + inyectar breadcrumbs.

La IA DECIDE los cortes; el código EXTRAE el contenido real del OCR.
"""

import json
import re
import traceback
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Callable
from openai import OpenAI

from config import settings


@dataclass
class SemanticChunk:
    """Un chunk creado semánticamente con ChatGPT-5.2."""
    section_id: str
    section_title: str
    content: str  # Ya incluye breadcrumb
    official_code: str
    chapter: str = ""
    parent_id: Optional[str] = None
    has_image: bool = False
    char_count: int = 0
    word_count: int = 0


@dataclass
class SemanticChunkingResult:
    """Resultado del chunking semántico."""
    success: bool
    chunks: List[SemanticChunk] = field(default_factory=list)
    total_chunks: int = 0
    total_cost_usd: float = 0.0
    error_message: Optional[str] = None
    official_code: str = ""
    document_type: str = ""
    agency: str = ""
    title: str = ""
    strategy: str = ""  # AI's reasoning about the chosen chunking approach


class SemanticChunker:
    """
    Chunker semántico en 2 fases:

    Fase 1 (IA - output pequeño):
      La IA lee el documento y devuelve un PLAN DE CORTE:
      - Metadata del documento (código, agencia, tipo, título)
      - Lista de secciones con: section_id, title, chapter, start, end

    Fase 2 (Código - determinístico):
      - Extraer texto real del OCR usando los índices start/end
      - Inyectar breadcrumbs: **[CODE] > [CHAPTER] > [SECTION]**
      - Si un chunk supera el límite de embeddings, subdividirlo
    """

    MODEL = settings.SEMANTIC_CHUNKER_MODEL
    INPUT_COST_PER_M = 2.50
    OUTPUT_COST_PER_M = 10.00

    MAX_CHUNK_CHARS = 20000   # Límite seguro para embeddings (~5K tokens)
    MIN_CHUNK_CHARS = 100     # Mínimo para considerar un chunk válido
    SPLIT_OVERLAP = 500       # Overlap al subdividir chunks grandes
    SECTION_OVERLAP = 300     # Overlap entre secciones contiguas (evita requisitos cortados)

    # Tamaño máximo de texto para enviar en una sola llamada de análisis
    MAX_ANALYSIS_CHARS = 400000  # ~100K tokens input — GPT-5.2 puede manejarlo

    ANALYSIS_PROMPT = """You are a Senior Aeronautical Data Engineer preparing documentation for a Vector Database (RAG system).

Your goal is to create the OPTIMAL CHUNKING PLAN for this specific document, maximizing retrieval quality when engineers search for regulatory information.

## STEP 1: METADATA EXTRACTION
Read the document header/cover (first 50-100 lines) to extract:
- **official_code:** Precise designation including revision/amendment suffix (e.g., "CS-23 Amendment 5", "AC 23-17C"). Capture the full suffix.
  - For ASTM standards, use the short canonical form: `F####M-##x` (e.g., `F3083M-23a`). Do NOT use the filename's dual form (e.g., `F3083_F3083M-23a`) — extract only the final code. Do NOT use internal reference numbers, UUIDs, or document tracking codes.
- **full_title:** Complete descriptive title of the standard (e.g., "Standard Specification for Emergency Conditions, Occupant Safety and Accommodations"). Do NOT use the filename or code as the title.
- **agency:** Issuing authority (ASTM, EASA, FAA, ICAO, etc.)
- **doc_type:** One of [Certification Specification, Advisory Circular, Standard, Manual, Regulation]

## STEP 2: ANALYZE & DECIDE THE BEST CHUNKING STRATEGY
Before you define sections, THINK about how this document will be searched and retrieved:

**Ask yourself:**
1. What kind of questions will engineers ask about this document?
   - Specific requirement lookups: "What does CS 23.2505 require?" → needs precise section-level chunks
   - Topic searches: "What are the fire protection requirements?" → needs topic-level chunks
   - Cross-reference searches: "Which section references FAR 25.853?" → needs context-complete chunks
2. What is the natural structure of this document?
   - Numbered sections (1, 2, 3...) → chunk by section, grouping short subsections
   - Subparts (A, B, C...) with individual requirements → chunk PER requirement (e.g., CS 23.2100 is one chunk)
   - Chapters with narrative text → chunk by topic change
   - Tables/Appendices → keep tables intact as their own chunk
3. What granularity maximizes retrieval?
   - Too coarse (entire chapters) → search results contain too much irrelevant text
   - Too fine (every paragraph) → chunks lose context, breadcrumbs overwhelm content
   - **Sweet spot:** each chunk should answer ONE specific question or cover ONE coherent topic

**Strategy examples by document type:**
- **ASTM Standard (F3083, F3411...):** Chunk by numbered section (1. Scope, 2. Referenced Documents, 4. Requirements). Group subsections (4.1, 4.1.1, 4.1.2) with their parent UNLESS a subsection is very long.
- **EASA CS (CS-23, CS-25...):** Chunk PER individual specification (CS 23.2100, CS 23.2105, CS 23.2110...) since engineers search for specific CS numbers. Group AMC/GM with their parent CS when co-located.
- **FAA AC (Advisory Circular):** Chunk by chapter/section since ACs are narrative. Split long chapters into topic-based sub-chunks.
- **ICAO Annex/Manual:** Chunk by chapter + numbered section within each chapter.

**Include your chosen strategy in the output as "strategy".**

## STEP 3: DEFINE THE SECTION BOUNDARIES
Apply your strategy and return EXACT character positions (0-based indices in the input text).

**CRITICAL RULES:**
- Sections MUST cover the ENTIRE document (no gaps, no overlaps)
- Each section MUST be self-contained (a reader should understand it without other chunks)
- Keep images `![...]()` with their referencing paragraph
- Keep tables intact within one chunk
- If a section exceeds 20,000 characters, split it at a logical subsection boundary and note it with "(Part N)" in the title
- Minimum chunk size: 100 characters (skip empty headers)

## OUTPUT FORMAT
Return ONLY this JSON (no markdown fences, no explanations):
{
  "doc_info": {
    "official_code": "ASTM F3083/F3083M-23a",
    "full_title": "Standard Specification for Emergency Conditions...",
    "agency": "ASTM",
    "doc_type": "Standard"
  },
  "strategy": "Chunking by numbered sections. Grouping subsections (e.g., 4.1-4.1.2) under parent section 4 because engineers typically search for the whole requirement, not individual sub-paragraphs. Tables kept as separate chunks for direct reference.",
  "sections": [
    {
      "section_id": "1",
      "title": "Scope",
      "chapter": "Section 1",
      "start": 0,
      "end": 2847
    },
    {
      "section_id": "2",
      "title": "Referenced Documents",
      "chapter": "Section 2",
      "start": 2848,
      "end": 5200
    }
  ]
}"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no está configurada")
        self.client = OpenAI(api_key=self.api_key)
        self.model = self.MODEL
        self.total_cost = 0.0

    def chunk_document(self,
                       text: str,
                       filename: str = "",
                       progress_callback: Optional[Callable[[str, int], None]] = None
                       ) -> SemanticChunkingResult:
        """
        Procesa un documento en chunks semánticos.

        Fase 1: IA analiza y devuelve plan de corte.
        Fase 2: Código extrae texto + inyecta breadcrumbs.
        """
        try:
            self.total_cost = 0.0

            # ============================================================
            # FASE 1: La IA analiza el documento y devuelve el plan de corte
            # ============================================================
            if progress_callback:
                progress_callback("ChatGPT-5.2 analizando estructura del documento...", 5)

            doc_info, sections, strategy = self._analyze_structure(text, progress_callback)

            if not sections:
                return SemanticChunkingResult(
                    success=False,
                    error_message="La IA no pudo identificar secciones en el documento."
                )

            official_code = doc_info.get("official_code", "Unknown")
            print(f"[SemanticChunker] Fase 1 completa: {len(sections)} secciones detectadas")
            print(f"[SemanticChunker] Metadata: {doc_info}")
            print(f"[SemanticChunker] Strategy: {strategy}")

            # ============================================================
            # FASE 1.5: Corregir boundaries usando anchoring textual
            # ============================================================
            if progress_callback:
                progress_callback("Verificando y corrigiendo boundaries...", 55)

            sections = self._correct_boundaries(text, sections)
            print(f"[SemanticChunker] Fase 1.5: boundaries corregidos")

            # ============================================================
            # FASE 2: Extraer texto determinísticamente + inyectar breadcrumbs
            # ============================================================
            if progress_callback:
                progress_callback(f"Extrayendo {len(sections)} secciones del texto...", 60)

            raw_chunks = self._extract_sections(text, sections, official_code)
            print(f"[SemanticChunker] Fase 2: {len(raw_chunks)} chunks extraídos")

            # ============================================================
            # FASE 3: Control de tamaño (subdividir chunks grandes)
            # ============================================================
            if progress_callback:
                progress_callback("Verificando tamaño de chunks para embeddings...", 80)

            final_chunks = self._enforce_size_limits(raw_chunks, official_code)
            print(f"[SemanticChunker] Fase 3: {len(final_chunks)} chunks finales (tras control de tamaño)")

            # Calcular estadísticas
            for chunk in final_chunks:
                chunk.char_count = len(chunk.content)
                chunk.word_count = len(chunk.content.split())

            if progress_callback:
                progress_callback("Chunking semántico completo!", 100)

            return SemanticChunkingResult(
                success=True,
                chunks=final_chunks,
                total_chunks=len(final_chunks),
                total_cost_usd=round(self.total_cost, 4),
                official_code=official_code,
                document_type=doc_info.get("doc_type", "other"),
                agency=doc_info.get("agency", "Unknown"),
                title=doc_info.get("full_title", ""),
                strategy=strategy
            )

        except Exception as e:
            traceback.print_exc()
            return SemanticChunkingResult(
                success=False,
                error_message=f"Error en chunking semántico: {str(e)}"
            )

    # ==================================================================
    # FASE 1: Análisis de estructura (IA)
    # ==================================================================

    def _analyze_structure(self, text: str, progress_callback=None) -> tuple:
        """
        Envía el texto a la IA para que analice la estructura.
        La IA devuelve metadata + plan de corte (pequeño JSON de output).

        Si el documento es muy largo, se analiza en partes y se fusionan los planes.
        """
        text_len = len(text)

        if text_len <= self.MAX_ANALYSIS_CHARS:
            # Documento cabe en una llamada
            return self._analyze_single(text)
        else:
            # Documento muy grande: analizar en partes
            return self._analyze_in_parts(text, progress_callback)

    def _analyze_single(self, text: str) -> tuple:
        """Analiza el documento completo en una sola llamada."""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                temperature=0.1,
                max_completion_tokens=8000,  # Plan de corte es pequeño
                messages=[
                    {"role": "system", "content": self.ANALYSIS_PROMPT},
                    {"role": "user", "content": f"DOCUMENT TEXT ({len(text)} characters):\n{text}"}
                ]
            )

            # Costo
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            cost = self._calculate_cost(input_tokens, output_tokens)
            self.total_cost += cost
            print(f"[SemanticChunker] Análisis: {input_tokens}in/{output_tokens}out, ${cost:.4f}")

            # Parsear
            response_text = response.choices[0].message.content.strip()
            data = self._parse_json_response(response_text)

            doc_info = data.get("doc_info", {})
            sections = data.get("sections", [])
            strategy = data.get("strategy", "No strategy provided")

            return doc_info, sections, strategy

        except Exception as e:
            print(f"Error en análisis de estructura: {e}")
            traceback.print_exc()
            return {}, [], ""

    def _analyze_in_parts(self, text: str, progress_callback=None) -> tuple:
        """
        Para documentos muy largos: analiza en partes solapadas.
        Primer bloque extrae metadata; los siguientes solo secciones.
        """
        block_size = self.MAX_ANALYSIS_CHARS
        overlap = 5000
        parts = []
        pos = 0

        while pos < len(text):
            end = min(pos + block_size, len(text))
            # Cortar en salto de línea
            if end < len(text):
                nl = text.rfind("\n", end - 1000, end)
                if nl > pos:
                    end = nl + 1
            parts.append((pos, text[pos:end]))
            pos = end - overlap if end < len(text) else len(text)

        print(f"[SemanticChunker] Documento muy largo ({len(text)} chars) → {len(parts)} partes de análisis")

        doc_info = {}
        all_sections = []

        for i, (offset, part_text) in enumerate(parts):
            if progress_callback:
                pct = 5 + int((i / len(parts)) * 50)
                progress_callback(f"ChatGPT-5.2 analizando parte {i+1}/{len(parts)}...", pct)

            if i == 0:
                part_doc_info, part_sections, strategy = self._analyze_single(part_text)
                doc_info = part_doc_info
            else:
                # Para partes siguientes, solo pedir secciones
                _, part_sections = self._analyze_continuation(part_text, offset, doc_info)

            # Ajustar offsets de las secciones
            for section in part_sections:
                section["start"] = section.get("start", 0) + offset
                section["end"] = section.get("end", 0) + offset

            all_sections.extend(part_sections)

        # Deduplicar secciones solapadas
        all_sections = self._merge_overlapping_sections(all_sections)

        return doc_info, all_sections, strategy

    def _analyze_continuation(self, text: str, offset: int, doc_info: Dict) -> tuple:
        """Analiza una parte adicional del documento (sin repetir metadata)."""
        continuation_prompt = f"""Continue analyzing the same document.
Document: {doc_info.get('official_code', 'Unknown')} - {doc_info.get('full_title', '')}

Identify ALL sections in this text segment. Return ONLY JSON:
{{
  "sections": [
    {{
      "section_id": "...",
      "title": "...",
      "chapter": "...",
      "start": 0,
      "end": 1234
    }}
  ]
}}

Character positions are relative to this text segment (starting at 0)."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                temperature=0.1,
                max_completion_tokens=4000,
                messages=[
                    {"role": "system", "content": continuation_prompt},
                    {"role": "user", "content": f"TEXT SEGMENT:\n{text}"}
                ]
            )

            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            cost = self._calculate_cost(input_tokens, output_tokens)
            self.total_cost += cost

            response_text = response.choices[0].message.content.strip()
            data = self._parse_json_response(response_text)

            return {}, data.get("sections", [])

        except Exception as e:
            print(f"Error en análisis de continuación: {e}")
            traceback.print_exc()
            return {}, []

    def _merge_overlapping_sections(self, sections: List[Dict]) -> List[Dict]:
        """Fusiona secciones duplicadas del análisis por partes."""
        seen = {}
        for section in sections:
            key = section.get("section_id", "")
            if key in seen:
                # Mantener la que tiene más rango
                existing = seen[key]
                existing_range = existing.get("end", 0) - existing.get("start", 0)
                new_range = section.get("end", 0) - section.get("start", 0)
                if new_range > existing_range:
                    seen[key] = section
            else:
                seen[key] = section

        # Ordenar por posición de inicio
        result = sorted(seen.values(), key=lambda s: s.get("start", 0))
        return result

    def _correct_boundaries(self, text: str, sections: list) -> list:
        """
        Corrige las posiciones start/end de las secciones usando anchoring textual.

        La IA calcula posiciones aproximadas. Este método busca los encabezados
        de sección reales en el texto y corrige las posiciones.

        Estrategia:
        1. Para cada sección, generar "anclas" (strings que deberían aparecer cerca del start)
        2. Buscar cada ancla en una ventana alrededor de la posición reportada
        3. Si se encuentra, corregir start a la posición real
        4. Ajustar ends: el end de sección N = start de sección N+1
        """
        if not sections:
            return sections

        text_len = len(text)
        corrected = []

        for section in sections:
            section_id = section.get("section_id", "")
            title = section.get("title", "")
            ai_start = section.get("start", 0)

            # Generar anclas de búsqueda basadas en section_id
            anchors = self._generate_section_anchors(section_id, title)

            if not anchors:
                # Sin anclas (sección genérica), mantener posición IA
                corrected.append(dict(section))
                continue

            # Buscar el ancla en una ventana alrededor de la posición reportada
            # La tolerancia es proporcional al tamaño del documento
            tolerance = max(10000, int(text_len * 0.15))
            search_start = max(0, ai_start - tolerance)
            search_end = min(text_len, ai_start + tolerance)
            search_window = text[search_start:search_end]

            best_match_pos = None
            found_anchor = None

            # 1. Local Search (Preferred)
            for anchor in anchors:
                pos = search_window.find(anchor)
                if pos != -1:
                    absolute_pos = search_start + pos
                    
                    # Refine to line start
                    # Look backwards for double newline (paragraph) or single newline
                    # Prioritize double newline to catch headers cleanly
                    para_start = text.rfind("\n\n", max(0, absolute_pos - 200), absolute_pos)
                    if para_start != -1:
                         candidate_pos = para_start + 2
                    else:
                        line_start = text.rfind("\n", max(0, absolute_pos - 200), absolute_pos)
                        candidate_pos = line_start + 1 if line_start != -1 else absolute_pos

                    if best_match_pos is None:
                        best_match_pos = candidate_pos
                        found_anchor = anchor
                    break # Stop at first (most specific) anchor found locally

            # 2. Global Fallback Search (If local failed)
            if best_match_pos is None:
                # print(f"[Boundary Warn] Local search failed for {section_id}. Trying global...")
                for anchor in anchors:
                    # Searching entire text for the anchor
                    # If it appears, we take the one closest to ai_start, or just the first if vague
                    # But for huge errors, closest might be wrong if there are many. 
                    # We assume section headers are somewhat unique or sequential.
                    
                    # Find ALL occurrences
                    start_search = 0
                    occurrences = []
                    while True:
                        idx = text.find(anchor, start_search)
                        if idx == -1:
                            break
                        occurrences.append(idx)
                        start_search = idx + 1
                    
                    if occurrences:
                        # Pick the occurrence closest to ai_start
                        closest = min(occurrences, key=lambda x: abs(x - ai_start))
                        
                        # Only accept if it's the *only* one or if we are reasonably confident
                        # For now, just taking the closest is better than nothing
                        best_match_pos = closest
                        found_anchor = anchor + " (Global)"
                        
                        # Refine to line start
                        line_start = text.rfind("\n", max(0, best_match_pos - 200), best_match_pos)
                        if line_start != -1:
                            best_match_pos = line_start + 1
                        break

            corrected_section = dict(section)
            if best_match_pos is not None:
                offset = best_match_pos - ai_start
                # Always correct it
                corrected_section["start"] = best_match_pos
                if abs(offset) > 100:
                    print(f"[Boundary Fix] {section_id}: {ai_start} -> {best_match_pos} (offset {offset:+d}, anchor='{found_anchor}')")
            else:
                 print(f"[Boundary Fail] Could not find anchor for {section_id} (tried {anchors[:2]}...)")

            corrected.append(corrected_section)

        # Ordenar por start corregido
        corrected.sort(key=lambda s: s.get("start", 0))

        # Ajustar ends: end de sección N = start de sección N+1 - 1
        for i in range(len(corrected) - 1):
            next_start = corrected[i + 1].get("start", 0)
            corrected[i]["end"] = next_start

        # Última sección: end = final del texto
        if corrected:
            corrected[-1]["end"] = text_len

        return corrected

    def _generate_section_anchors(self, section_id: str, title: str) -> list:
        """
        Genera cadenas de anclaje para buscar una sección en el texto.
        Retorna una lista ordenada por especificidad (más específica primero).
        """
        anchors = []

        # Para secciones CS-23 (e.g., "23.2270" or "cs_23_2270")
        cs_match = re.match(r'^(?:cs_)?23[._](\d{4})', section_id)
        if cs_match:
            four_digits = cs_match.group(1)
            cs_num = f"23.{four_digits}"
            # Remove _p1, _p2 suffixes
            anchors.append(f"# CS {cs_num} {title[:15]}") # High confidence with title
            anchors.append(f"## CS {cs_num} {title[:15]}")
            anchors.append(f"CS {cs_num} {title[:15]}")    # Text based anchor
            anchors.append(f"# CS {cs_num}")           # Markdown heading
            anchors.append(f"## CS {cs_num}")           # H2
            anchors.append(f"CS {cs_num} ")             # Inline reference with space
            anchors.append(f"CS {cs_num}\n")            # Followed by newline

        # Para secciones GM/AMC (e.g., "GM3_23.2010")
        elif re.match(r'^(GM|AMC)\d*_', section_id):
            parts = section_id.split("_", 1)
            prefix = parts[0].replace("_", " ")  # "GM3" or "AMC1"
            cs_num = parts[1] if len(parts) > 1 else ""
            anchors.append(f"# {prefix} {cs_num}")
            anchors.append(f"## {prefix} {cs_num}")
            anchors.append(f"{prefix} {cs_num}")

        # Para secciones numeradas simples (ASTM: "1", "2", "4A")
        elif re.match(r'^\d+[A-Z]?$', section_id):
            if title:
                anchors.append(f"# {title}")
                # Also try with section number prefix
                anchors.append(f"{section_id} {title}")

        # Para secciones con nombre (preamble, toc, front_matter)
        elif section_id in ("toc", "preamble_cs23", "preamble_amcgm", "front_matter"):
            if title:
                anchors.append(title[:40])

        return anchors

    # ==================================================================
    # FASE 2: Extracción de texto + inyección de breadcrumbs
    # ==================================================================

    def _extract_sections(self, text: str, sections: List[Dict], official_code: str) -> List[SemanticChunk]:
        """
        Extrae el texto real del OCR para cada sección y le inyecta el breadcrumb.
        100% determinístico — no usa IA.
        """
        chunks = []
        text_len = len(text)

        for i, section in enumerate(sections):
            section_id = section.get("section_id", "")
            title = section.get("title", "")
            chapter = section.get("chapter", "")
            start = max(0, min(section.get("start", 0), text_len))
            end = max(start, min(section.get("end", text_len), text_len))

            # Añadir overlap con la sección siguiente para no cortar requisitos a medias
            if i < len(sections) - 1:
                next_start = max(0, min(sections[i + 1].get("start", end), text_len))
                overlap_end = min(next_start + self.SECTION_OVERLAP, text_len)
            else:
                overlap_end = end

            # Extraer contenido real del OCR (con overlap al final)
            raw_content = text[start:overlap_end].strip()

            if len(raw_content) < self.MIN_CHUNK_CHARS:
                continue

            # Construir breadcrumb
            breadcrumb = self._build_breadcrumb(official_code, chapter, section_id, title)

            # Contenido final = breadcrumb + texto real del OCR
            full_content = f"{breadcrumb}\n\n{raw_content}"

            # Detectar si tiene imágenes
            has_image = "![" in raw_content

            chunk = SemanticChunk(
                section_id=section_id,
                section_title=title,
                content=full_content,
                official_code=official_code,
                chapter=chapter,
                has_image=has_image
            )
            chunks.append(chunk)

        return chunks

    def _build_breadcrumb(self, official_code: str, chapter: str, section_id: str, title: str) -> str:
        """Construye el breadcrumb: **[CODE] > [CHAPTER] > [SECTION_ID TITLE]**"""
        parts = [f"**[{official_code}]**"]
        if chapter:
            parts.append(f"**[{chapter}]**")
        section_part = ""
        if section_id and title:
            section_part = f"**[{section_id} {title}]**"
        elif section_id:
            section_part = f"**[{section_id}]**"
        elif title:
            section_part = f"**[{title}]**"
        if section_part:
            parts.append(section_part)
        return " > ".join(parts) + ":"

    # ==================================================================
    # FASE 3: Control de tamaño para embeddings
    # ==================================================================

    def _enforce_size_limits(self, chunks: List[SemanticChunk], official_code: str) -> List[SemanticChunk]:
        """
        Si un chunk supera MAX_CHUNK_CHARS, lo subdivide en partes más pequeñas.
        Cada sub-chunk mantiene el breadcrumb con " (Part N)" añadido.
        """
        result = []

        for chunk in chunks:
            if len(chunk.content) <= self.MAX_CHUNK_CHARS:
                result.append(chunk)
            else:
                # Subdividir chunk grande
                sub_chunks = self._split_large_chunk(chunk, official_code)
                result.extend(sub_chunks)

        return result

    def _split_large_chunk(self, chunk: SemanticChunk, official_code: str) -> List[SemanticChunk]:
        """
        Subdivide un chunk grande en partes respetando párrafos.
        Cada parte mantiene el breadcrumb con sufijo " (Part N)".
        """
        # Separar breadcrumb del contenido
        lines = chunk.content.split("\n", 2)
        breadcrumb = lines[0] if lines else ""
        body = lines[2] if len(lines) > 2 else chunk.content

        # Dividir el body en párrafos
        paragraphs = re.split(r'\n{2,}', body)

        parts = []
        current_part = []
        current_size = 0
        target_size = self.MAX_CHUNK_CHARS - len(breadcrumb) - 200  # Margen para headers

        for para in paragraphs:
            para_size = len(para)

            if current_size + para_size > target_size and current_part:
                # Guardar parte actual
                parts.append("\n\n".join(current_part))
                # Overlap: repetir último párrafo si es razonable
                if para_size < self.SPLIT_OVERLAP:
                    current_part = [current_part[-1], para] if current_part else [para]
                    current_size = len(current_part[0]) + para_size
                else:
                    current_part = [para]
                    current_size = para_size
            else:
                current_part.append(para)
                current_size += para_size

        # Última parte
        if current_part:
            parts.append("\n\n".join(current_part))

        # Si un solo párrafo es más grande que el target, cortarlo por frases
        final_parts = []
        for part in parts:
            if len(part) > target_size:
                sentence_parts = self._split_by_sentences(part, target_size)
                final_parts.extend(sentence_parts)
            else:
                final_parts.append(part)

        # Crear chunks con breadcrumbs numerados
        sub_chunks = []
        total_parts = len(final_parts)
        for i, part_content in enumerate(final_parts, 1):
            part_suffix = f" (Part {i}/{total_parts})" if total_parts > 1 else ""
            part_breadcrumb = breadcrumb.rstrip(":") + part_suffix + ":"

            sub_chunk = SemanticChunk(
                section_id=f"{chunk.section_id}_p{i}" if total_parts > 1 else chunk.section_id,
                section_title=f"{chunk.section_title}{part_suffix}".strip(),
                content=f"{part_breadcrumb}\n\n{part_content}",
                official_code=official_code,
                chapter=chunk.chapter,
                has_image="![" in part_content
            )
            sub_chunks.append(sub_chunk)

        return sub_chunks if sub_chunks else [chunk]

    def _split_by_sentences(self, text: str, target_size: int) -> List[str]:
        """Subdivide texto largo cortando en puntos (frases)."""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        parts = []
        current = []
        current_size = 0

        for sent in sentences:
            if current_size + len(sent) > target_size and current:
                parts.append(" ".join(current))
                current = [sent]
                current_size = len(sent)
            else:
                current.append(sent)
                current_size += len(sent)

        if current:
            parts.append(" ".join(current))

        return parts

    # ==================================================================
    # UTILIDADES
    # ==================================================================

    def _parse_json_response(self, response_text: str) -> Dict:
        """Parsea JSON de la respuesta de ChatGPT-5.2."""
        # Intentar directamente
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            pass

        # Extraer de code blocks
        try:
            match = re.search(r'```(?:json)?\s*(.*?)\s*```', response_text, re.DOTALL)
            if match:
                return json.loads(match.group(1))
        except (json.JSONDecodeError, AttributeError):
            pass

        # Buscar cualquier JSON object
        try:
            match = re.search(r'\{[\s\S]*\}', response_text)
            if match:
                return json.loads(match.group(0))
        except (json.JSONDecodeError, AttributeError):
            pass

        print(f"ERROR: No se pudo parsear JSON")
        print(f"Respuesta (primeros 500 chars): {response_text[:500]}")
        raise ValueError(f"No se pudo parsear JSON: {response_text[:200]}")

    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calcula costo de la llamada a ChatGPT-5.2."""
        input_cost = (input_tokens / 1_000_000) * self.INPUT_COST_PER_M
        output_cost = (output_tokens / 1_000_000) * self.OUTPUT_COST_PER_M
        return input_cost + output_cost


# ==========================================================================
# FUNCIÓN DE CONVENIENCIA
# ==========================================================================

def chunk_document_semantic(text: str, filename: str = "") -> SemanticChunkingResult:
    """Función de conveniencia para chunking semántico."""
    chunker = SemanticChunker()
    return chunker.chunk_document(text, filename)
