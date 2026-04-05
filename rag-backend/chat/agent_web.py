"""
Web-compatible version of AeronauticalAgent.
Uses JSON file-based config instead of PyQt6 QSettings.
"""

import json
from pathlib import Path
from typing import Optional, Callable

from openai import OpenAI
from anthropic import Anthropic
from config.settings import settings
from database.supabase_client import SupabaseClient
from core.embeddings import EmbeddingsGenerator
from chat.reranker import CohereReranker
from chat.memory import ConversationMemory
from chat.query_expander import QueryExpander
from chat.reference_extractor import ReferenceExtractor
from utils.logger import logger

# Import the original agent's dataclass and system prompt
from chat.agent import AgentResponse, AeronauticalAgent

_DATA_DIR = Path("/app/data") if Path("/app/data").exists() else Path(__file__).resolve().parent.parent / "api"
MODEL_CONFIG_PATH = _DATA_DIR / "model_config.json"


def _load_model_config() -> dict:
    if MODEL_CONFIG_PATH.exists():
        with open(MODEL_CONFIG_PATH) as f:
            return json.load(f)
    return {"id": "openai/gpt-4o", "name": "GPT-4o", "temperature": 0.2}


class AeronauticalAgentWeb(AeronauticalAgent):
    """
    Subclass that replaces PyQt6 QSettings with JSON file config.
    Inherits all RAG logic from the original agent.
    """

    def __init__(self, api_key: Optional[str] = None):
        # Skip parent __init__ entirely — we replicate it without PyQt6
        cfg = _load_model_config()
        self.model = cfg.get("id", "openai/gpt-4o")
        self.temperature = float(cfg.get("temperature", 0.2))
        self.max_tokens = int(cfg.get("max_tokens", 2000))
        self.top_k_chunks = int(cfg.get("top_k", 10))
        self.relevance_threshold = float(cfg.get("relevance_threshold", 0.3))
        self.custom_system_prompt = cfg.get("system_prompt", "") or ""

        openrouter_key = api_key or getattr(settings, 'OPENROUTER_API_KEY', '')

        self.use_claude = False

        if openrouter_key:
            self.openai_client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=openrouter_key
            )
            print(f"[Web] Using OpenRouter: {self.model} (Temp: {self.temperature})")
        else:
            self.use_claude = getattr(settings, 'USE_CLAUDE_FOR_CHAT', False)
            if self.use_claude:
                self.anthropic_key = api_key or settings.ANTHROPIC_API_KEY
                self.claude_client = Anthropic(api_key=self.anthropic_key)
                self.model = self.model if "/" not in self.model else getattr(
                    settings, 'ANTHROPIC_CHAT_MODEL', 'claude-sonnet-4-5-20250929')
                print(f"[Web] Using Claude Direct: {self.model} (Temp: {self.temperature})")
            else:
                self.openai_key = api_key or settings.OPENAI_API_KEY
                self.openai_client = OpenAI(api_key=self.openai_key)
                self.model = self.model.split("/")[-1] if "/" in self.model else self.model
                print(f"[Web] Using OpenAI Direct: {self.model} (Temp: {self.temperature})")

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

    # ── Overrides that apply model_config settings ─────────────────

    def query(self, question: str, top_k: int = 20,
              rerank_top_k: int = 7,
              expand_context: bool = True,
              use_query_expansion: bool = True,
              progress_callback: Optional[Callable[[str], None]] = None) -> AgentResponse:
        """Override to inject top_k_chunks from model config."""
        effective_top_k = self.top_k_chunks if self.top_k_chunks else top_k
        return super().query(
            question,
            top_k=effective_top_k,
            rerank_top_k=rerank_top_k,
            expand_context=expand_context,
            use_query_expansion=use_query_expansion,
            progress_callback=progress_callback,
        )

    def _call_llm(self, question: str, context: str, conversation_history: list,
                  param_block: str = "") -> tuple:
        """Override to apply max_tokens and custom_system_prompt from model config."""
        # Temporarily patch model settings for this call
        original_system = self.SYSTEM_PROMPT

        # Inject custom system prompt if set
        if self.custom_system_prompt:
            self.__class__.SYSTEM_PROMPT = self.custom_system_prompt + "\n\n---\n\n" + original_system

        user_message = f"""### DOCUMENT CONTEXT:
{context}
{param_block}
### USER QUESTION:
{question}

### YOUR RESPONSE:"""

        try:
            if self.use_claude:
                messages = []
                for msg in conversation_history:
                    messages.append({"role": msg["role"], "content": msg["content"]})
                messages.append({"role": "user", "content": user_message})

                response = self.claude_client.messages.create(
                    model=self.model,
                    max_tokens=self.max_tokens,
                    system=self.SYSTEM_PROMPT,
                    messages=messages,
                    temperature=self.temperature,
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
                    max_tokens=self.max_tokens,
                )
                tokens = 0
                if hasattr(response, 'usage') and response.usage:
                    tokens = getattr(response.usage, 'total_tokens', 0)
                return response.choices[0].message.content, tokens
        finally:
            # Restore original system prompt
            self.__class__.SYSTEM_PROMPT = original_system

    def _build_context(self, documents: list) -> str:
        """Override to apply relevance threshold before building context."""
        filtered = self._apply_relevance_threshold(documents)
        return super()._build_context(filtered)

    def _apply_relevance_threshold(self, results: list) -> list:
        """Filter out chunks whose score is below relevance_threshold."""
        if not self.relevance_threshold or self.relevance_threshold <= 0:
            return results
        filtered = []
        for r in results:
            score = getattr(r, 'rerank_score', None)
            if score is None:
                score = getattr(r, 'similarity', 1.0)
            if score >= self.relevance_threshold:
                filtered.append(r)
        kept = len(filtered)
        total = len(results)
        if kept < total:
            print(f"[Web] Relevance threshold {self.relevance_threshold}: kept {kept}/{total} chunks")
        # Always keep at least 1 result to avoid empty context
        return filtered if filtered else results[:1]
