import time
from typing import Optional, Union
from openai import OpenAI
from config import settings


class EmbeddingsGenerator:
    def __init__(self, api_key=None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError('OPENAI_API_KEY no está configurada')
        self.client = OpenAI(api_key=self.api_key)
        self.model = settings.EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIM

    def _embed_with_retry(self, texts):
        max_retries = 5
        for attempt in range(max_retries):
            try:
                response = self.client.embeddings.create(
                    model=self.model,
                    input=texts,
                    dimensions=self.dimensions,
                )
                return response
            except Exception as e:
                is_rate_limit = '429' in str(e) or 'rate_limit' in str(e).lower()
                if is_rate_limit and attempt < max_retries - 1:
                    delay = 60
                    import re
                    match = re.search(r'retry.{0,20}?(\d+)\s*s', str(e), re.IGNORECASE)
                    if match:
                        delay = int(match.group(1))
                    print(f"[Embeddings] Rate limit hit, waiting {delay}s...")
                    time.sleep(delay)
                else:
                    raise

    def generate(self, text):
        texts = [text] if isinstance(text, str) else list(text or [])
        texts = [t.strip() for t in texts if isinstance(t, str) and t.strip()]
        if not texts:
            return []
        response = self._embed_with_retry(texts)
        return [item.embedding for item in (response.data or [])]

    def generate_single(self, text):
        results = self.generate(text)
        return results[0] if results else []

    def generate_batch(self, texts, batch_size=100):
        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch_embeddings = self.generate(texts[i:i+batch_size])
            all_embeddings.extend(batch_embeddings)
        return all_embeddings

    def get_embedding_dimension(self):
        return self.dimensions


def generate_embedding(text):
    return EmbeddingsGenerator().generate_single(text)
