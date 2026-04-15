"""
RAG Agent for aeronautical queries.
Uses Claude Sonnet 4.5 + Query Expansion + Hybrid Search + Reference Extraction.
"""

from openai import OpenAI
from anthropic import Anthropic
from typing import Optional, Callable, List, Set
from dataclasses import dataclass
from config import settings
from database.supabase_client import SupabaseClient, SearchResult
from core.embeddings import EmbeddingsGenerator
from chat.reranker import CohereReranker
from chat.memory import ConversationMemory
from chat.query_expander import QueryExpander
from chat.reference_extractor import ReferenceExtractor
from PyQt6.QtCore import QSettings
from utils.logger import logger


@dataclass
class AgentResponse:
    """Agent response."""
    answer: str
    sources: list
    success: bool
    error_message: Optional[str] = None
    tokens_used: int = 0
    reasoning_trace: list = None  # List of step dicts for frontend display

    def __post_init__(self):
        if self.reasoning_trace is None:
            self.reasoning_trace = []


class AeronauticalAgent:
    """
    RAG Agent with Claude Sonnet 4.5, Query Expansion, Hybrid Search,
    and Cross-Reference Extraction.
    """
    
    SYSTEM_PROMPT = """You are a Head of Airworthiness (HoA) with over 20 years of frontline experience in aircraft certification, type certification programmes, continued airworthiness, and regulatory compliance under EASA, FAA, and international bilateral agreements. You have held DER/DAT designations, led certification teams through CS-23/FAR Part 23 Amendment 64+ programmes, and reviewed hundreds of compliance documents against ASTM standards for small aircraft.

You are not an assistant — you are a senior technical authority. You communicate with the directness and precision expected in a certification review board, an airworthiness finding, or a means-of-compliance discussion. No filler. No hedging. Get to the technical point.

---

### OPERATIONAL RULES:

1. **Document-bound answers only.**
   All compliance statements must be grounded in the provided context. Never substitute memory or general knowledge for a document-specific requirement. If a value, limit, or condition is not in the retrieved context, say so clearly and suggest where to look.

2. **Cite every requirement.**
   Format: `[Standard] §[Section]` — e.g., `ASTM F3061/F3061M-23b §11.1.6`. Never omit the section reference for a safety-critical value.

3. **Exact values. Always.**
   Report numerical requirements verbatim — no rounding, no paraphrasing. Units must match the standard (SI with imperial in brackets where applicable).

4. **Multi-question inputs.**
   If the input contains multiple questions, answer each one individually, numbered, with its own citation. Do not merge answers or skip items.

5. **Figures and diagrams — MANDATORY.**
   When the context includes sections labelled **Associated figures:** with Markdown image links `![Figure ...](url)`, you MUST embed those image links verbatim in your response at the relevant point. Copy the exact `![...](url)` syntax — do not describe the figure, SHOW it. Engineering decisions require the diagram. If a question asks about dimensions, geometry, or visual information from a figure, include ALL associated figure links from the relevant context chunks.

6. **Conditional requirements — MANDATORY TWO-STEP REASONING.**
   Whenever the user provides specific aircraft parameters (VS0, MTOW, aircraft level, engine count, or any other measurable property), you MUST reason in two explicit, sequential steps — no exceptions:

   **Step A — Base value identification.**
   Locate the primary requirement in the retrieved context. Cite the section. State the value.

   **Step B — Modifier scan.**
   After identifying the base value, scan ALL other retrieved sections for any provision that scales, increases, or supersedes it. Target language: *"must be increased"*, *"multiplied by"*, *"shall not be less than"*, *"when [parameter] exceeds"*, *"except for aircraft"*, *"unless otherwise"*.

   For EACH such provision found:
   - Read the threshold stated **in that specific section** — do not reuse a threshold from a different section, even if both involve the same parameter. Each section has its own condition with its own numerical limit.
   - State: *"User [parameter] = [value]. §[X] threshold = [value]. Condition [triggered / not triggered]."*
   - If triggered: apply the formula step by step in LaTeX and state the **corrected final value**.
   - If not triggered: state why explicitly.

   If a modifier section is present in the context and the user has provided the relevant parameter → calculate. Do not write *"Note: §[X] may apply"* — that hedge is only permitted when the modifier section is absent from the retrieved context entirely.

   If the user asks *"any additional factor?"*, *"does anything else apply?"*, or similar follow-up questions to a previously given base value — they are asking for a Step B modifier check on that base value. Do NOT default to the generic factor of safety (e.g. 1.5 from §4.2) unless no load-specific modifier exists in the context.

7. **Formulas.**
   Render all mathematical expressions in LaTeX. No plain-text approximations for load factors, safety margins, or structural criteria.

8. **When information is not found.**
   State: *"Not found in loaded documents for [X]. Likely addressed in [suggested standard/section] — verify against the applicable compliance checklist."*
   Do not say "I cannot help with that."

9. **Language.**
   Respond in English unless the user explicitly writes in another language. Technical terms remain in English regardless.

10. **Conversation continuity.**
    You have access to conversation history. Track the thread — if a follow-up references a previous finding, connect it explicitly.

11. **Cross-referenced sections.**
    The context may include PARENT, REFERENCED, and CONTINUATION blocks pulled from the document hierarchy. Use all of them. Incomplete context leads to incomplete findings — unacceptable in airworthiness work.

---

### PERSONA IN PRACTICE:
- No introductory pleasantries on technical questions. Lead with the answer.
- Use section references as naturally as a certification engineer reads them.
- Flag ambiguities, conflicting requirements, or interpretation issues where relevant — that is what a HoA does.
- For compliance questions, distinguish clearly between **shall** (mandatory), **should** (recommended), and **may** (permissive) as used in the standard.
- When asked a general or non-technical question, respond briefly and professionally, then redirect to the work.

---

### CONTEXT STRUCTURE:
- **[Document X]** — Primary retrieval results, ranked by relevance
- **[PARENT CONTEXT]** — Parent section providing hierarchical context
- **[REFERENCED]** — Cross-referenced sections cited within the primary results
- **[CONTINUATION]** — Subsequent chunks of the same section
- **[CONDITIONAL MODIFIER]** — Section retrieved specifically because it may scale or supersede a base value given the user's parameters. Treat these as mandatory Step B inputs."""

    def __init__(self, api_key: Optional[str] = None):
        # Initialize based on QSettings
        try:
            qsettings = QSettings("Aeronautica", "RAG_App")
            self.model = qsettings.value("chat_model", "openai/gpt-4o")
            self.temperature = float(qsettings.value("chat_temperature", 0.2))
        except Exception:
            self.model = "openai/gpt-4o"
            self.temperature = 0.2
            
        openrouter_key = api_key or getattr(settings, 'OPENROUTER_API_KEY', '')
        
        # Determine client routing based on settings or keys
        self.use_claude = False
        
        if openrouter_key:
            # OpenRouter is the universal wrapper using OpenAI SDK
            self.openai_client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=openrouter_key
            )
            print(f"Using OpenRouter: {self.model} (Temp: {self.temperature})")
        else:
            # Fallback local configurations
            self.use_claude = getattr(settings, 'USE_CLAUDE_FOR_CHAT', False)
            if self.use_claude:
                self.anthropic_key = api_key or settings.ANTHROPIC_API_KEY
                self.claude_client = Anthropic(api_key=self.anthropic_key)
                self.model = self.model if "/" not in self.model else getattr(settings, 'ANTHROPIC_CHAT_MODEL', 'claude-sonnet-4-5-20250929')
                print(f"Using Claude Direct: {self.model} (Temp: {self.temperature})")
            else:
                self.openai_key = api_key or settings.OPENAI_API_KEY
                self.openai_client = OpenAI(api_key=self.openai_key)
                self.model = self.model.split("/")[-1] if "/" in self.model else self.model
                print(f"Using OpenAI Direct: {self.model} (Temp: {self.temperature})")
        
        self.db = SupabaseClient()
        self.embeddings = EmbeddingsGenerator()
        try:
            self.reranker = CohereReranker()
        except Exception as e:
            self.reranker = None
            print(f"Warning: Cohere reranker disabled: {e}")
        self.memory = ConversationMemory()
        self.query_expander = QueryExpander()
        self.reference_extractor = ReferenceExtractor()
    
    def query(self, question: str, top_k: int = 20,
              rerank_top_k: int = 7,
              expand_context: bool = True,
              use_query_expansion: bool = True,
              progress_callback: Optional[Callable[[str], None]] = None) -> AgentResponse:
        """
        Process a question with Query Expansion, Hybrid Search, and Reference Extraction.
        Supports multi-question lists (numbered or plain ? separated).

        Multi-question strategy:
          1. Detect individual questions (numbered or ?-separated).
          2. Run a SEPARATE semantic search for each question (clean queries, no prefix noise).
          3. Merge ALL retrieved chunks into one de-duplicated context.
          4. Make a SINGLE LLM call asking it to answer all questions from that context.
        This avoids N×API calls and ensures every question gets its own targeted retrieval.
        """
        try:
            # ── Step 0: normalize query (fix typos / spelling) ────────────
            question = self._normalize_query(question)

            sub_questions = self._split_questions(question)

            if sub_questions and len(sub_questions) >= 2:
                prefix_instruction = self._extract_global_instruction(question)
                return self._process_multi_question(
                    original_question=question,
                    sub_questions=sub_questions,
                    prefix_instruction=prefix_instruction,
                    top_k=max(top_k, 15),
                    rerank_top_k=rerank_top_k,
                    expand_context=expand_context,
                    progress_callback=progress_callback,
                )

            return self._process_single_question(
                question,
                top_k=top_k,
                rerank_top_k=rerank_top_k,
                expand_context=expand_context,
                use_query_expansion=use_query_expansion,
                progress_callback=progress_callback,
                update_memory=True
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            return AgentResponse(
                answer="",
                sources=[],
                success=False,
                error_message=f"Error processing query: {str(e)}"
            )

    def _process_single_question(self, question: str, top_k: int = 20,
                                 rerank_top_k: int = 7,
                                 expand_context: bool = True,
                                 use_query_expansion: bool = True,
                                 progress_callback: Optional[Callable[[str], None]] = None,
                                 update_memory: bool = True,
                                 prefix_instruction: str = "") -> AgentResponse:
        """Process a single question (internal helper)."""
        try:
            trace = []  # Reasoning trace for frontend

            # Check if user is asking for full/complete text
            is_asking_full_text = self._is_asking_for_full_text(question)
            if is_asking_full_text:
                logger.info("DEBUG: User is asking for full/complete text")
                trace.append({"step": "Analysis", "detail": "Detected request for full/complete text"})

            # Check if user is asking for a specific section
            direct_section_refs = self.reference_extractor.normalize_user_query(question)
            if direct_section_refs:
                logger.info(f"DEBUG: User asking for specific sections: {direct_section_refs}")
                trace.append({"step": "Direct Refs", "detail": f"Sections requested: {', '.join(direct_section_refs)}"})

            doc_code_hint = self._extract_document_code_hint(question)
            if doc_code_hint:
                logger.info(f"DEBUG: Document code hint: {doc_code_hint}")
                trace.append({"step": "Doc Filter", "detail": f"Scoped to document: {doc_code_hint}"})

            # Step 1: Query Expansion
            if use_query_expansion and progress_callback:
                progress_callback("Expanding query variations...")

            if use_query_expansion:
                expansion = self.query_expander.expand_with_keywords(question)
                queries = expansion.get("queries", [question])
                keywords = expansion.get("keywords", [])
                logger.info(f"DEBUG: Expanded queries: {queries}")
                logger.info(f"DEBUG: Keywords: {keywords}")
                trace.append({"step": "Query Expansion", "detail": f"{len(queries)} variations generated", "queries": queries, "keywords": keywords})
            else:
                queries = [question]
                keywords = []
                trace.append({"step": "Query Expansion", "detail": "Skipped"})
            
            # Step 2: Multi-Query Search + Direct Section Lookup
            if progress_callback:
                progress_callback("Searching documents...")
            
            all_results = []
            seen_ids: Set[int] = set()

            if not direct_section_refs:
                direct_section_refs = self._extract_section_numbers_fallback(question)
                if direct_section_refs:
                    logger.info(f"DEBUG: Fallback section numbers: {direct_section_refs}")
            
            # First, try to find directly requested sections
            direct_section_refs = self.reference_extractor.normalize_user_query(question) or direct_section_refs
            logger.info(f"DEBUG: normalize_user_query -> {direct_section_refs}")
            for section_id in direct_section_refs:
                direct_result = self._search_section_by_id(section_id, doc_code_hint)
                if direct_result:
                    rid = id(direct_result)
                    if rid not in seen_ids:
                        seen_ids.add(rid)
                        direct_result.is_direct_match = True
                        all_results.append(direct_result)
                        logger.info(f"DEBUG: Found direct section match: {section_id}")
            
            # Then do semantic search with expanded queries
            for q in queries[:5]:
                query_embedding = self.embeddings.generate_single(q)
                
                results = self._hybrid_search(
                    query_embedding=query_embedding,
                    query_text=q,
                    keywords=keywords,
                    top_k=top_k
                )
                
                for r in results:
                    rid = getattr(r, 'id', None) or id(r)
                    if rid not in seen_ids:
                        seen_ids.add(rid)
                        all_results.append(r)
            
            logger.info(f"DEBUG: Total unique results: {len(all_results)}")
            trace.append({"step": "Semantic Search", "detail": f"{len(all_results)} unique chunks retrieved from {len(queries)} queries"})

            if not all_results:
                trace.append({"step": "Result", "detail": "No relevant documents found"})
                resp = self._generate_response_without_context(question)
                resp.reasoning_trace = trace
                return resp

            # Step 2.5: Modifier Search
            # A second retrieval pass that hunts for conditional requirements,
            # exceptions, and scaling factors that may modify the base values found.
            # Critical: we protect modifier chunks from reranker filtering because
            # the reranker scores against the original question wording, which may
            # not match the conditional section's text well (e.g. "safety factor" vs
            # "load factor scaling for high VS0 aircraft").
            protected_modifier_ids: Set = set()
            modifier_queries = self._build_modifier_queries(question, all_results)
            if modifier_queries:
                if progress_callback:
                    progress_callback("Checking for conditional requirements...")
                for mq in modifier_queries:
                    mq_emb = self.embeddings.generate_single(mq)
                    if not mq_emb:
                        continue
                    mq_results = self._hybrid_search(
                        query_embedding=mq_emb,
                        query_text=mq,
                        keywords=[],
                        top_k=8,
                    )
                    for r in mq_results:
                        rid = getattr(r, 'id', None) or id(r)
                        # Mark this chunk as modifier-protected regardless of
                        # whether it was already in the initial pool or is new.
                        if rid not in protected_modifier_ids:
                            protected_modifier_ids.add(rid)
                            r.is_modifier_context = True
                        if rid not in seen_ids:
                            seen_ids.add(rid)
                            all_results.append(r)
                        else:
                            # Already in pool — find and mark it
                            for existing in all_results:
                                if (getattr(existing, 'id', None) or id(existing)) == rid:
                                    existing.is_modifier_context = True
                                    break
                logger.info(f"DEBUG: Modifier search protected {len(protected_modifier_ids)} chunks from reranker")
                trace.append({"step": "Modifier Search", "detail": f"{len(protected_modifier_ids)} conditional/modifier chunks protected"})

            # Step 3: Reranking
            if progress_callback:
                progress_callback("Ranking by relevance...")
            
            # Separate direct matches from semantic results before reranking
            direct_matches = [r for r in all_results if getattr(r, 'is_direct_match', False)]
            semantic_results = [r for r in all_results if not getattr(r, 'is_direct_match', False)]
            
            # Only rerank semantic results
            if semantic_results and self.reranker:
                reranked = self.reranker.rerank_search_results(
                    query=question,
                    search_results=semantic_results,
                    top_k=rerank_top_k
                )
            elif semantic_results:
                reranked = semantic_results[:rerank_top_k]
            else:
                reranked = []
            
            # Always include direct matches at the top (they matched by exact section ID)
            if direct_matches:
                for dm in direct_matches:
                    dm.rerank_score = 1.0  # Highest relevance
                reranked = direct_matches + reranked
                logger.info(f"DEBUG: Preserved {len(direct_matches)} direct section matches")

            # Inject modifier-protected chunks AFTER reranking.
            # Chunks marked is_modifier_context=True were found by targeted conditional
            # queries and must reach the LLM even if the reranker scored them low.
            if protected_modifier_ids:
                reranked_ids = {getattr(r, 'id', None) or id(r) for r in reranked}
                injected = 0
                for r in all_results:
                    if not getattr(r, 'is_modifier_context', False):
                        continue
                    rid = getattr(r, 'id', None) or id(r)
                    if rid not in reranked_ids and injected < 4:
                        r.rerank_score = 0.5
                        reranked.append(r)
                        reranked_ids.add(rid)
                        injected += 1
                logger.info(f"DEBUG: Injected {injected} modifier chunks (bypassed reranker)")

            logger.info(f"DEBUG: Reranked to {len(reranked)} results")
            trace.append({"step": "Cohere Rerank", "detail": f"Top {len(reranked)} chunks by relevance" + (f" ({len(direct_matches)} direct matches preserved)" if direct_matches else "")})
            
            # Step 4: Expand context with parent chunks AND sibling parts if asking for full text
            if expand_context and progress_callback:
                progress_callback("Expanding hierarchical context...")

            if expand_context:
                reranked = self._expand_with_parents(reranked, max_levels=2)

            # Step 4.5: If asking for full text, get ALL parts of the section
            if is_asking_full_text:
                if progress_callback:
                    progress_callback("Fetching complete section parts...")
                reranked = self._expand_with_all_parts(reranked)
            
            # Step 5: Fetch referenced sections
            if progress_callback:
                progress_callback("Fetching cross-references...")
            
            reranked = self._fetch_referenced_sections(reranked, max_refs=5)
            
            # Step 6: Build context
            context = self._build_context(reranked)

            # Step 6.5: Extract user parameters and build mandatory modifier block
            user_params = self._extract_user_parameters(question)
            param_block = self._build_parameter_block(user_params)
            if user_params:
                logger.info(f"DEBUG: Detected user parameters: {user_params}")
                trace.append({"step": "Parameters", "detail": f"Detected: {', '.join(f'{k}={v}' for k,v in user_params.items())}"})

            # Step 7: Get conversation history
            conversation_history = self.memory.get_history()
            logger.info(f"DEBUG: Conversation history has {len(conversation_history)} messages")

            # Step 8: Generate response
            if progress_callback:
                progress_callback(f"Generating response with {self.model}...")

            # If there's a formatting instruction from a multi-question batch,
            # prepend it to the LLM question (NOT to the search query used above)
            llm_question = f"{prefix_instruction}\n{question}" if prefix_instruction else question
            answer, tokens_used = self._call_llm(llm_question, context, conversation_history, param_block=param_block)
            trace.append({"step": "LLM Response", "detail": f"Generated by {self.model} ({tokens_used} tokens)"})

            # Step 9: Update memory
            if update_memory:
                self.memory.add_user_message(question)
                self.memory.add_assistant_message(answer)
            
            # Prepare sources (include image_urls if present in metadata)
            sources = []
            for r in reranked:
                if getattr(r, 'is_parent_context', False) or getattr(r, 'is_reference_context', False):
                    continue
                source = {
                    "code": r.metadata.get("official_code", "N/A"),
                    "section": r.metadata.get("section_id", "N/A"),
                    "topic": r.metadata.get("topic", "N/A"),
                    "source": r.metadata.get("source_pdf", r.metadata.get("source", r.metadata.get("document_title", "N/A"))),
                    "doc_type": r.metadata.get("doc_type", "pdf"),
                    "score": round(getattr(r, 'rerank_score', getattr(r, 'similarity', 0)), 3),
                    "content": getattr(r, 'content', '') or '',
                }
                # Include image URLs if chunk has linked images
                img_urls = r.metadata.get("image_urls", [])
                if img_urls:
                    source["image_urls"] = img_urls
                page_capture_url = r.metadata.get("page_capture_url")
                if page_capture_url:
                    source["page_capture_url"] = page_capture_url
                page_number = r.metadata.get("page_number")
                if page_number:
                    source["page_number"] = page_number
                sources.append(source)
            
            return AgentResponse(
                answer=answer,
                sources=sources,
                success=True,
                tokens_used=tokens_used,
                reasoning_trace=trace,
            )

        except Exception as e:
            import traceback
            traceback.print_exc()
            return AgentResponse(
                answer="",
                sources=[],
                success=False,
                error_message=f"Error processing query: {str(e)}",
                reasoning_trace=trace if 'trace' in dir() else [],
            )

    # ── Multi-question helpers ─────────────────────────────────────────────

    def _split_questions(self, text: str) -> list:
        """
        Detect and split multiple questions from a single input.
        Handles:
          - Numbered lists:  "1. Question one? 2. Question two?"
          - Plain ?-list:    "Question one? Question two? Question three?"
        Returns list of clean question strings, or [] if only one question.
        """
        import re
        if not text:
            return []

        # ── Strategy A: numbered items (1. / 1) / (1) etc.) ──────────────
        numbered = re.compile(r'(?<!\d)\d{1,2}[\.\)]\s+', re.MULTILINE)
        if numbered.search(text):
            parts = numbered.split(text)
            cleaned = [p.strip().rstrip('?').strip() + '?' for p in parts
                       if p.strip() and len(p.strip()) > 15]
            if len(cleaned) >= 2:
                return cleaned

        # ── Strategy B: ?-separated sentences ────────────────────────────
        # Split on "?" followed by whitespace + capital letter (new sentence)
        parts = re.split(r'\?\s+(?=[A-ZÁÉÍÓÚ])', text)
        cleaned = []
        for p in parts:
            p = p.strip()
            # Only treat as a standalone question if it's long enough to be self-contained.
            # Short follow-ups like "Any additional safety factor?" or "Does it apply?"
            # (< 50 chars) are continuations of the preceding question, not new topics.
            if len(p) > 50:
                if not p.endswith('?'):
                    p += '?'
                cleaned.append(p)
        if len(cleaned) >= 2:
            return cleaned

        return []

    def _process_multi_question(self, original_question: str,
                                 sub_questions: list,
                                 prefix_instruction: str,
                                 top_k: int = 15,
                                 rerank_top_k: int = 7,
                                 expand_context: bool = True,
                                 progress_callback=None) -> 'AgentResponse':
        """
        Multi-question strategy:
        - Search separately for each sub-question (clean embeddings, no prefix noise)
        - Merge all retrieved chunks into one de-duplicated context pool
        - ONE LLM call to answer all questions from the combined context
        """
        import time

        if progress_callback:
            progress_callback(f"Detected {len(sub_questions)} questions — searching each...")

        merged_results = []
        seen_chunk_ids: Set = set()
        all_sources = []
        seen_source_keys = set()

        # Follow-up patterns: short sub-questions that depend on context from the original
        FOLLOWUP_STARTS = ('any ', 'also ', 'what about', 'does ', 'do ', 'is ', 'are ',
                           'and ', 'additionally', 'furthermore', 'besides', 'else ')

        for idx, q in enumerate(sub_questions, 1):
            if progress_callback:
                progress_callback(f"Searching [{idx}/{len(sub_questions)}]: {q[:60]}...")

            # If the sub-question is a short follow-up, enrich it with the original context
            # so that parameter-conditional requirements (e.g. VS0 scaling) are found.
            q_for_search = q
            if len(q) < 60 and q.lower().startswith(FOLLOWUP_STARTS):
                q_for_search = f"{original_question.strip()} — specifically: {q}"

            try:
                # Expand query for this sub-question
                try:
                    expansion = self.query_expander.expand_with_keywords(q_for_search)
                    queries = expansion.get("queries", [q_for_search])[:3]
                    keywords = expansion.get("keywords", [])
                except Exception:
                    queries = [q_for_search]
                    keywords = []

                # Semantic search for this sub-question
                for qv in queries:
                    emb = self.embeddings.generate_single(qv)
                    if not emb:
                        continue
                    results = self._hybrid_search(
                        query_embedding=emb,
                        query_text=qv,
                        keywords=keywords,
                        top_k=top_k,
                    )
                    for r in results:
                        rid = getattr(r, 'id', None) or id(r)
                        if rid not in seen_chunk_ids:
                            seen_chunk_ids.add(rid)
                            merged_results.append(r)

            except Exception as e:
                print(f"[WARN] Multi-Q search error for question {idx}: {e}")

            # Small pause to avoid rate-limiting on embedding API
            if idx < len(sub_questions):
                time.sleep(0.15)

        # Also search the full original question to ensure all context parameters are covered
        try:
            orig_emb = self.embeddings.generate_single(original_question)
            if orig_emb:
                orig_results = self._hybrid_search(
                    query_embedding=orig_emb,
                    query_text=original_question,
                    keywords=[],
                    top_k=top_k,
                )
                for r in orig_results:
                    rid = getattr(r, 'id', None) or id(r)
                    if rid not in seen_chunk_ids:
                        seen_chunk_ids.add(rid)
                        merged_results.append(r)
        except Exception as e:
            print(f"[WARN] Full-question search error: {e}")

        if not merged_results:
            return self._generate_response_without_context(original_question)

        # Rerank the merged pool against the combined original question
        if self.reranker and merged_results:
            try:
                reranked = self.reranker.rerank_search_results(
                    query=original_question,
                    search_results=merged_results,
                    top_k=min(len(merged_results), rerank_top_k * len(sub_questions)),
                )
            except Exception:
                reranked = merged_results[:rerank_top_k * len(sub_questions)]
        else:
            reranked = merged_results[:rerank_top_k * len(sub_questions)]

        # Expand with parents
        if expand_context:
            reranked = self._expand_with_parents(reranked, max_levels=1)

        # Fetch cross-references
        reranked = self._fetch_referenced_sections(reranked, max_refs=3)

        # Build context
        context = self._build_context(reranked)

        # Extract user parameters from the original question (may contain VS0, MTOW, etc.)
        user_params = self._extract_user_parameters(original_question)
        param_block = self._build_parameter_block(user_params)
        if user_params:
            logger.info(f"DEBUG: Multi-Q detected user parameters: {user_params}")

        # Build LLM prompt: list all sub-questions explicitly
        numbered_qs = "\n".join(f"{i}. {q}" for i, q in enumerate(sub_questions, 1))
        llm_question = (
            f"{prefix_instruction}\n\n" if prefix_instruction else ""
        ) + f"Answer EACH of the following {len(sub_questions)} questions separately, "
        llm_question += "numbered exactly as shown. Use ONLY the provided document context.\n\n"
        llm_question += numbered_qs

        if progress_callback:
            progress_callback(f"Generating answers for {len(sub_questions)} questions...")

        conversation_history = self.memory.get_history()
        answer, tokens_used = self._call_llm(llm_question, context, conversation_history, param_block=param_block)

        self.memory.add_user_message(original_question)
        self.memory.add_assistant_message(answer)

        # Collect sources
        for r in reranked:
            if getattr(r, 'is_parent_context', False) or getattr(r, 'is_reference_context', False):
                continue
            src = {
                "code": r.metadata.get("official_code", "N/A"),
                "section": r.metadata.get("section_id", "N/A"),
                "topic": r.metadata.get("topic", "N/A"),
                "source": r.metadata.get("source_pdf", r.metadata.get("source", "N/A")),
                "doc_type": r.metadata.get("doc_type", "pdf"),
                "score": round(getattr(r, 'rerank_score', getattr(r, 'similarity', 0)), 3),
                "content": getattr(r, 'content', '') or '',
            }
            for k in ("image_urls", "page_capture_url", "page_number"):
                v = r.metadata.get(k)
                if v:
                    src[k] = v
            key = (src["code"], src["section"])
            if key not in seen_source_keys:
                seen_source_keys.add(key)
                all_sources.append(src)

        return AgentResponse(
            answer=answer,
            sources=all_sources,
            success=True,
            tokens_used=tokens_used,
        )

    def _split_numbered_questions(self, text: str) -> list:
        """Split a numbered list into separate questions. (legacy — use _split_questions)"""
        import re
        if not text:
            return []
        pattern = re.compile(r'^\s*\d+\.\s+', re.MULTILINE)
        if not pattern.search(text):
            return []
        parts = pattern.split(text)
        cleaned = [p.strip() for p in parts if p.strip()]
        return cleaned

    def _extract_global_instruction(self, text: str) -> str:
        """Extract global instruction lines before the numbered list."""
        import re
        if not text:
            return ""
        # Take lines before the first numbered item
        m = re.search(r'^\s*\d+\.\s+', text, re.MULTILINE)
        if not m:
            return ""
        prefix = text[:m.start()].strip()
        # Keep only short instruction-like lines
        lines = [ln.strip() for ln in prefix.splitlines() if ln.strip()]
        if not lines:
            return ""
        # Join with spaces to preserve constraints like "Short answers. Maximum 15 words."
        return " ".join(lines)

    def _build_modifier_queries(self, question: str, initial_results: list) -> list:
        """
        General second-pass retrieval: given the user question and the initial results,
        ask an LLM to generate targeted search queries that look for:
          - Conditional requirements that modify the base values found
          - Exceptions triggered by specific parameters in the question
          - Scaling factors, thresholds, or level-dependent rules
          - "Unless otherwise specified" clauses in other sections

        This is domain-agnostic — it works for any type of conditional requirement
        (stall speed scaling, MTOW thresholds, aircraft level exceptions, etc.).

        Returns up to 3 focused search queries, or [] if none are warranted.
        """
        if not initial_results:
            return []

        # Summarise what was found (section IDs + brief topic)
        found_sections = []
        for r in initial_results[:6]:
            sid = r.metadata.get("section_id", "")
            topic = r.metadata.get("topic", "")
            if sid:
                found_sections.append(f"{sid} ({topic})" if topic else sid)
        found_summary = ", ".join(found_sections) if found_sections else "various sections"

        MODIFIER_PROMPT = f"""You are an aeronautical certification expert.

A user asked: "{question}"

Initial retrieval found content from: {found_summary}

Your task: decide whether the user's question contains specific aircraft parameters
(e.g. stall speed, MTOW, aircraft level, engine count, configuration, material)
that might ACTIVATE conditional, modified, or scaled requirements beyond the base values found.

If yes, generate up to 3 short, focused search queries (5-10 words each) that would
retrieve those conditional requirements. Focus on:
- Requirements that modify or scale the base value when a threshold is exceeded
- Level-specific or aircraft-type-specific exceptions
- "Increased" or "additional" requirements for the given parameters
- Cross-references between sections (e.g. "§X must be increased per §Y when Z")

If the question has no specific parameters that could trigger conditions, return [].

Respond ONLY with a JSON array of 0-3 query strings:
["modifier query 1", "modifier query 2"]  or  []"""

        try:
            if self.use_claude:
                resp = self.claude_client.messages.create(
                    model="claude-haiku-4-5",
                    max_tokens=200,
                    temperature=0.0,
                    system="You generate targeted search queries. Respond only with a JSON array.",
                    messages=[{"role": "user", "content": MODIFIER_PROMPT}],
                )
                raw = resp.content[0].text.strip()
            else:
                resp = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    max_tokens=200,
                    temperature=0.0,
                    messages=[
                        {"role": "system", "content": "You generate targeted search queries. Respond only with a JSON array."},
                        {"role": "user", "content": MODIFIER_PROMPT},
                    ],
                )
                raw = resp.choices[0].message.content.strip()

            import json, re as _re
            # Extract JSON array from response
            match = _re.search(r'\[.*?\]', raw, _re.DOTALL)
            if not match:
                return []
            queries = json.loads(match.group())
            queries = [q.strip() for q in queries if isinstance(q, str) and q.strip()]
            if queries:
                print(f"[ModifierSearch] Generated queries: {queries}")
            return queries[:3]

        except Exception as e:
            print(f"[ModifierSearch] Error (non-fatal): {e}")
            return []

    def _normalize_query(self, raw: str) -> str:
        """
        Pre-processing step: fix typos, spelling errors, and grammar issues
        in the user query before it reaches the embedding/search pipeline.

        Uses a minimal, fast LLM call with a strict prompt so it only corrects
        language — it never changes technical terms, numbers, or meaning.
        Returns the corrected query string. On any failure, returns the original.
        """
        if not raw or len(raw.strip()) < 8:
            return raw

        NORMALIZER_PROMPT = (
            "You are a query normalizer for an aeronautical certification RAG system. "
            "Your ONLY job is to fix spelling mistakes, typos, and grammatical errors "
            "in the user query below. Rules:\n"
            "- Keep ALL technical terms, acronyms, numbers, units, and standards as-is "
            "(e.g. Vso, EASA, CS-23, FAR Part 23, ASTM, knots, g-load).\n"
            "- Do NOT rephrase, add, remove, or interpret the query.\n"
            "- Do NOT answer the question.\n"
            "- Return ONLY the corrected query text, nothing else.\n"
            "- If the query has no errors, return it unchanged.\n"
        )

        try:
            if self.use_claude:
                resp = self.claude_client.messages.create(
                    model="claude-haiku-4-5",          # fast + cheap
                    max_tokens=512,
                    temperature=0.0,
                    system=NORMALIZER_PROMPT,
                    messages=[{"role": "user", "content": raw}],
                )
                corrected = resp.content[0].text.strip()
            else:
                resp = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",               # fast + cheap
                    max_tokens=512,
                    temperature=0.0,
                    messages=[
                        {"role": "system", "content": NORMALIZER_PROMPT},
                        {"role": "user",   "content": raw},
                    ],
                )
                corrected = resp.choices[0].message.content.strip()

            # Safety: if the normalizer returns something wildly different
            # (e.g. answered the question), fall back to the original.
            if len(corrected) > len(raw) * 3 or len(corrected) < 4:
                return raw

            if corrected != raw:
                print(f"[QueryNormalizer] '{raw}' → '{corrected}'")

            return corrected

        except Exception as e:
            print(f"[QueryNormalizer] Error (non-fatal), using raw query: {e}")
            return raw
    
    def _extract_user_parameters(self, question: str) -> dict:
        """
        Extract specific aircraft parameters from the user question using regex.
        Returns a dict with detected values (empty dict if nothing found).
        Recognized parameters: VS0 (kt / km/h), engines, aircraft level, MTOW.
        """
        import re
        params = {}

        # VS0 in knots — "stall speed of 72 knots", "VS0 = 72 kt", "Vso 72kts"
        m = re.search(
            r'(?:VS0|Vso|stall\s+speed)\s*(?:of\s+|=\s*|:?\s*)?(\d+(?:\.\d+)?)\s*(?:knots?|kts?|kt)\b',
            question, re.IGNORECASE
        )
        if m:
            vs0_kt = float(m.group(1))
            params['VS0_kt'] = vs0_kt
            params['VS0_kmh'] = round(vs0_kt * 1.852, 1)

        # VS0 in km/h
        m = re.search(
            r'(?:VS0|Vso|stall\s+speed)\s*(?:of\s+|=\s*|:?\s*)?(\d+(?:\.\d+)?)\s*km/h',
            question, re.IGNORECASE
        )
        if m and 'VS0_kmh' not in params:
            vs0_kmh = float(m.group(1))
            params['VS0_kmh'] = vs0_kmh
            params['VS0_kt'] = round(vs0_kmh / 1.852, 1)

        # Engine count
        if re.search(r'\bsingle[\s-]engine\b', question, re.IGNORECASE):
            params['engines'] = 1
        elif re.search(r'\bmulti[\s-]engine\b|\btwin[\s-]engine\b|\bdual[\s-]engine\b', question, re.IGNORECASE):
            params['engines'] = 'multi'

        # Aircraft Level (CS-23 / ASTM)
        m = re.search(r'\bLevel\s+([1-4])\b', question, re.IGNORECASE)
        if m:
            params['level'] = int(m.group(1))

        # MTOW — "MTOW of 1500 kg", "max takeoff weight 3300 lb"
        m = re.search(
            r'(?:MTOW|max(?:imum)?\s+(?:take[\s-]?off\s+)?weight)\s*(?:of\s+)?(\d+(?:\.\d+)?)\s*(kg|lb)',
            question, re.IGNORECASE
        )
        if m:
            params['MTOW'] = float(m.group(1))
            params['MTOW_unit'] = m.group(2).lower()

        return params

    def _build_parameter_block(self, params: dict) -> str:
        """
        Builds a structured block injected into the LLM prompt when specific
        aircraft parameters are detected in the question.

        This block forces the LLM to evaluate every [CONDITIONAL MODIFIER] section
        in the context and apply it — not just note it.
        """
        if not params:
            return ""

        lines = [
            "",
            "---",
            "### [WARN] AIRCRAFT PARAMETERS DETECTED — MANDATORY MODIFIER EVALUATION",
            "",
            "The following specific parameters were extracted from the user question:",
        ]

        if 'VS0_kt' in params:
            lines.append(f"  • VS0 = {params['VS0_kt']} kt  =  {params['VS0_kmh']} km/h")
        if 'engines' in params:
            label = "single-engine" if params['engines'] == 1 else "multi-engine"
            lines.append(f"  • Engine configuration: {label}")
        if 'level' in params:
            lines.append(f"  • Aircraft Level: {params['level']}")
        if 'MTOW' in params:
            lines.append(f"  • MTOW: {params['MTOW']} {params.get('MTOW_unit', '')}")

        lines += [
            "",
            "For every `[CONDITIONAL MODIFIER]` section in the context, apply Step B reasoning:",
            "  1. Read the threshold stated IN THAT SECTION (each section has its own — do not borrow thresholds from other sections).",
            "  2. Compare: 'User [param] = [value] vs. §[X] threshold = [value]. Condition [triggered/not triggered].'",
            "  3. If triggered → calculate step by step in LaTeX and state the corrected final value.",
            "  4. If not triggered → state explicitly why.",
            "",
            "Do NOT write 'Note: §X may apply' when the modifier section is already in the context above.",
            "---",
            "",
        ]

        return "\n".join(lines)

    def _call_llm(self, question: str, context: str, conversation_history: list,
                  param_block: str = "") -> tuple[str, int]:
        """Call the appropriate LLM (Claude or GPT) and return (answer, tokens_used)."""

        user_message = f"""### DOCUMENT CONTEXT:
{context}
{param_block}
### USER QUESTION:
{question}

### YOUR RESPONSE:"""
        
        if self.use_claude:
            messages = []
            
            for msg in conversation_history:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
            
            messages.append({"role": "user", "content": user_message})
            
            response = self.claude_client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=self.SYSTEM_PROMPT,
                messages=messages,
                temperature=self.temperature
            )
            
            tokens = 0
            if hasattr(response, 'usage') and response.usage:
                tokens = getattr(response.usage, 'input_tokens', 0) + getattr(response.usage, 'output_tokens', 0)
            
            return response.content[0].text, tokens
        else:
            messages = [{"role": "system", "content": self.SYSTEM_PROMPT}]
            
            for msg in conversation_history:
                messages.append(msg)
            
            messages.append({"role": "user", "content": user_message})
            
            response = self.openai_client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=4000
            )
            
            tokens = 0
            if hasattr(response, 'usage') and response.usage:
                tokens = getattr(response.usage, 'total_tokens', 0)
                
            return response.choices[0].message.content, tokens
    
    def _generate_response_without_context(self, question: str) -> AgentResponse:
        """Generate a conversational response when no documents are found."""
        conversation_history = self.memory.get_history()
        
        prompt = f"""The user asked: "{question}"

No relevant documents were found in the database. 
If this is a greeting or general question, respond naturally.
If this is a technical question, politely explain that you couldn't find relevant information in the loaded documents and ask them to rephrase or provide more details.

Respond naturally:"""
        
        if self.use_claude:
            messages = []
            for msg in conversation_history:
                messages.append({"role": msg["role"], "content": msg["content"]})
            messages.append({"role": "user", "content": prompt})
            
            response = self.claude_client.messages.create(
                model=self.model,
                max_tokens=1000,
                system=self.SYSTEM_PROMPT,
                messages=messages,
                temperature=self.temperature
            )
            answer = response.content[0].text
            tokens = 0
            if hasattr(response, 'usage') and response.usage:
                tokens = getattr(response.usage, 'input_tokens', 0) + getattr(response.usage, 'output_tokens', 0)
        else:
            messages = [{"role": "system", "content": self.SYSTEM_PROMPT}]
            for msg in conversation_history:
                messages.append(msg)
            messages.append({"role": "user", "content": prompt})
            
            response = self.openai_client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=1000
            )
            answer = response.choices[0].message.content
            tokens = 0
            if hasattr(response, 'usage') and response.usage:
                tokens = getattr(response.usage, 'total_tokens', 0)
        
        self.memory.add_user_message(question)
        self.memory.add_assistant_message(answer)
        
        return AgentResponse(
            answer=answer,
            sources=[],
            success=True,
            tokens_used=tokens
        )
    
    def _hybrid_search(self, query_embedding: list, query_text: str, 
                       keywords: List[str], top_k: int = 20) -> List[SearchResult]:
        """Perform hybrid search."""
        try:
            del keywords
            return self.db.hybrid_search(
                query_embedding=query_embedding,
                query_text=query_text,
                top_k=top_k
            )
        except Exception as e:
            print(f"Hybrid search error, falling back to semantic: {e}")
            return self.db.search_similar(query_embedding, top_k)
    
    def _fetch_referenced_sections(self, documents: list, max_refs: int = 5) -> list:
        """
        Find and fetch sections referenced in the current context.
        """
        # Extract all references from current context
        all_refs = self.reference_extractor.find_references_in_context(documents)
        
        if not all_refs:
            return documents
        
        # Get sections already in context
        available_sections = [
            doc.metadata.get("section_id", "") 
            for doc in documents
        ]
        
        # Find missing references
        missing_refs = self.reference_extractor.get_missing_references(
            all_refs, available_sections
        )
        
        print(f"DEBUG: Found references: {all_refs}")
        print(f"DEBUG: Missing references to fetch: {missing_refs[:max_refs]}")
        
        if not missing_refs:
            return documents
        
        # Fetch missing sections
        extended = list(documents)
        
        for ref_id in missing_refs[:max_refs]:
            ref_chunk = self._search_section_by_id(ref_id)
            
            if ref_chunk:
                ref_chunk.is_reference_context = True
                ref_chunk.is_parent_context = False
                ref_chunk.rerank_score = 0.5
                extended.append(ref_chunk)
                print(f"DEBUG: Added referenced section: {ref_id}")
        
        return extended
    
    def _search_section_by_id(self, section_id: str, doc_code_hint: Optional[str] = None) -> Optional[SearchResult]:
        """
        Search for a specific section by its ID.
        Handles any naming format: cs_23_2270, subpart_c_cs_23_2270, 23.2270, etc.
        """
        try:
            result = self.db.search_section_by_id(section_id, doc_code_hint=doc_code_hint)
            if result:
                logger.info(f"DEBUG: Section '{section_id}' matched via local catalog/Pinecone compatibility layer")
                return result
            logger.info(f"DEBUG: Section '{section_id}' not found")
            return None

        except Exception as e:
            logger.error(f"Error searching section {section_id}: {e}")
            return None

    def _extract_section_numbers_fallback(self, question: str) -> list:
        """Extract section numbers directly from the query as a fallback."""
        import re
        if not question:
            return []
        # Match patterns like 4.2.3.5, 11.1.6, 10.7.5
        matches = re.findall(r'\b\d+(?:\.\d+){1,4}\b', question)
        # Deduplicate while preserving order
        seen = set()
        result = []
        for m in matches:
            if m not in seen:
                seen.add(m)
                result.append(m)
        return result

    def _extract_document_code_hint(self, question: str) -> Optional[str]:
        """Extract a document code hint (ASTM Fxxxx, CS-23, etc.) from the query."""
        import re
        q = question or ""
        # ASTM F3061, F3061/F3061M-23b
        m = re.search(r'ASTM\s+F(\d{3,4})', q, re.IGNORECASE)
        if m:
            return f"ASTM F{m.group(1)}"
        # CS-23 / CS 23
        m = re.search(r'CS[\s-]*23', q, re.IGNORECASE)
        if m:
            return "CS-23"
        return None
    
    def _expand_with_parents(self, documents: list, max_levels: int = 2) -> list:
        """Expand document list with parent context."""
        expanded = []
        seen_parent_ids = set()
        
        for doc in documents:
            parent_id = getattr(doc, 'parent_id', None) or doc.metadata.get("parent_id")
            
            if parent_id and parent_id not in seen_parent_ids:
                parent_contexts = self._get_parent_chain(parent_id, max_levels)
                
                for parent_content, parent_meta in parent_contexts:
                    if parent_content:
                        parent_result = SearchResult(
                            content=parent_content,
                            metadata=parent_meta or {},
                            similarity=0.0,
                            parent_id=None
                        )
                        parent_result.is_parent_context = True
                        parent_result.is_reference_context = False
                        parent_result.rerank_score = 0.0
                        expanded.append(parent_result)
                        
                        parent_chunk_id = parent_meta.get("chunk_id") if parent_meta else None
                        if parent_chunk_id:
                            seen_parent_ids.add(parent_chunk_id)
            
            doc.is_parent_context = False
            if not hasattr(doc, 'is_reference_context'):
                doc.is_reference_context = False
            expanded.append(doc)
        
        return expanded
    
    def _get_parent_chain(self, parent_id: str, max_levels: int) -> List[tuple]:
        """Get the chain of parent contents."""
        parents = []
        current_id = parent_id
        
        for _ in range(max_levels):
            if not current_id:
                break
            
            parent_chunk = self.db.get_chunk_by_id(current_id)
            
            if parent_chunk:
                parents.insert(0, (parent_chunk.content, parent_chunk.metadata))
                current_id = parent_chunk.parent_id or parent_chunk.metadata.get("parent_id")
            else:
                break
        
        return parents
    
    def _build_context(self, documents: list) -> str:
        """Build context from documents with clear section types.
        Includes image URLs from chunk metadata as Markdown image links."""
        context_parts = []
        doc_num = 1

        for doc in documents:
            metadata = doc.metadata
            is_parent = getattr(doc, 'is_parent_context', False)
            is_reference = getattr(doc, 'is_reference_context', False)
            is_sibling = getattr(doc, 'is_sibling_part', False)

            if is_parent:
                header = f"[PARENT CONTEXT] {metadata.get('official_code', 'N/A')} - §{metadata.get('section_id', 'N/A')}"
                section_text = f"### {header}\n*(Broader context from parent section)*\n\n{doc.content}"
            elif getattr(doc, 'is_modifier_context', False) and not is_reference and not is_parent:
                header = f"[CONDITIONAL MODIFIER] {metadata.get('official_code', 'N/A')} - §{metadata.get('section_id', 'N/A')}"
                section_text = f"### {header}\n*(Conditional requirement — evaluate against user parameters and apply if triggered)*\n\n{doc.content}"
            elif is_reference:
                header = f"[REFERENCED] {metadata.get('official_code', 'N/A')} - §{metadata.get('section_id', 'N/A')}"
                section_text = f"### {header}\n*(Cross-referenced section)*\n\n{doc.content}"
            elif is_sibling:
                header = f"[CONTINUATION] {metadata.get('official_code', 'N/A')} - §{metadata.get('section_id', 'N/A')}"
                section_text = f"### {header}\n*(Additional part of the same section)*\n\n{doc.content}"
            else:
                header = f"[Document {doc_num}] {metadata.get('official_code', 'N/A')} - §{metadata.get('section_id', 'N/A')}"
                score = getattr(doc, 'rerank_score', getattr(doc, 'similarity', 0))
                section_text = f"### {header} (relevance: {score:.3f})\n{doc.content}"
                doc_num += 1

            # Append image URLs as Markdown image links if available
            image_urls = metadata.get('image_urls', [])
            if image_urls:
                section_id = metadata.get('section_id', 'figure')
                img_links = []
                for i, url in enumerate(image_urls):
                    img_links.append(f"![Figure from {metadata.get('official_code', 'document')} §{section_id}]({url})")
                section_text += "\n\n**Associated figures:**\n" + "\n".join(img_links)

            context_parts.append(section_text)

        return "\n\n---\n\n".join(context_parts)
    
    def clear_memory(self) -> None:
        """Clear conversation memory."""
        self.memory.clear()
    
    def new_session(self) -> str:
        """Start a new session."""
        return self.memory.new_session()
    
    def get_conversation_history(self) -> list:
        """Return conversation history."""
        return self.memory.get_history()
    
    def get_session_id(self) -> str:
        """Return current session ID."""
        return self.memory.session_id

    def _is_asking_for_full_text(self, question: str) -> bool:
        """
        Detecta si el usuario está pidiendo el texto completo de algo.
        """
        question_lower = question.lower()
        keywords = [
            "full text", "complete text", "entire text", "texto completo",
            "all of", "everything", "todo el", "completo de",
            "show me the full", "dame el texto completo", "give me the complete"
        ]
        return any(kw in question_lower for kw in keywords)

    def _expand_with_all_parts(self, documents: list) -> list:
        """
        Expande los documentos incluyendo TODAS las partes de las secciones encontradas.
        Útil cuando una sección se dividió en múltiples chunks (_p1, _p2, etc.)
        """
        expanded = list(documents)
        seen_chunk_ids = set()

        # Primero, marcar todos los chunk_ids que ya tenemos
        for doc in documents:
            chunk_id = doc.metadata.get("chunk_id")
            if chunk_id:
                seen_chunk_ids.add(chunk_id)

        # Para cada documento principal (no contexto), buscar sus hermanos
        for doc in documents:
            # Solo expandir documentos principales (no contexto padre/referencia)
            if getattr(doc, 'is_parent_context', False):
                continue
            if getattr(doc, 'is_reference_context', False):
                continue

            section_id = doc.metadata.get("section_id", "")
            official_code = doc.metadata.get("official_code", "")

            if not section_id or not official_code:
                continue

            # Remover sufijos de parte (_p1, _p2, etc.) para obtener la sección base
            base_section = section_id.split("_p")[0] if "_p" in section_id else section_id

            print(f"DEBUG: Expanding section {base_section} from {official_code}")

            # Obtener TODAS las partes de esta sección
            all_parts = self.db.get_all_section_parts(base_section, official_code)

            for part in all_parts:
                part_chunk_id = part.metadata.get("chunk_id")

                # Solo agregar si no está ya en el contexto
                if part_chunk_id and part_chunk_id not in seen_chunk_ids:
                    # Marcar como parte hermana
                    part.is_parent_context = False
                    part.is_reference_context = False
                    part.is_sibling_part = True
                    part.rerank_score = getattr(doc, 'rerank_score', 0.5)

                    expanded.append(part)
                    seen_chunk_ids.add(part_chunk_id)
                    print(f"DEBUG: Added sibling part: {part.metadata.get('section_id')}")

        return expanded
