"""
Query Expander using LLM.
Generates query variations to improve retrieval.
"""

from openai import OpenAI
from typing import List, Optional
from config import settings


class QueryExpander:
    """
    Expands user queries into multiple variations for better retrieval.
    Uses LLM to generate synonyms, rephrasings, and related terms.
    """
    
    EXPANSION_PROMPT = """You are a query expansion system for aeronautical documentation search.
Given a user question, generate 5 alternative phrasings that would help find relevant information in technical documents like ASTM standards, FAA regulations, and EASA certification specs.

IMPORTANT RULES:
1. Include synonyms and technical alternatives (e.g., "seat belt" → "safety belt", "restraint system", "harness")
2. Include both formal and informal phrasings
3. Include specific technical terms that might appear in standards
4. Keep queries short and focused (3-8 words each)
5. Include the original query as the first item
6. Consider common misspellings or variations
7. If the question contains specific aircraft parameters (stall speed, MTOW, aircraft level, engine count),
   include at least one variant that searches for conditional or modified requirements triggered by those parameters
   (e.g. "increased load factor", "exception for [aircraft type]", "modified requirement when [parameter]")

USER QUESTION: {question}

Respond ONLY with a JSON array of 5 queries, nothing else:
["original query", "variation 1", "variation 2", "variation 3", "variation 4"]"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.client = OpenAI(api_key=self.api_key)
    
    def expand(self, question: str, num_variations: int = 5) -> List[str]:
        """
        Expand a question into multiple query variations.
        
        Args:
            question: Original user question
            num_variations: Number of variations to generate
            
        Returns:
            List of query variations including original
        """
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",  # Fast and cheap for this task
                temperature=0.7,
                max_tokens=200,
                messages=[
                    {
                        "role": "user",
                        "content": self.EXPANSION_PROMPT.format(question=question)
                    }
                ]
            )
            
            content = response.choices[0].message.content.strip()
            
            # Parse JSON response
            import json
            queries = json.loads(content)
            
            # Ensure original is first
            if question.lower() not in [q.lower() for q in queries]:
                queries.insert(0, question)
            
            return queries[:num_variations]
            
        except Exception as e:
            print(f"Query expansion error: {e}")
            # Fallback: return original query
            return [question]
    
    def expand_with_keywords(self, question: str) -> dict:
        """
        Expand query and extract keywords for hybrid search.

        Returns:
            dict with 'queries' (list) and 'keywords' (list)
        """
        try:
            prompt = f"""Analyze this aeronautical certification query and provide:
1. 5 query variations for semantic search
2. 10 important keywords for text search (include technical terms, numbers, acronyms)

IMPORTANT — if the question contains specific aircraft parameters (stall speed, MTOW, aircraft level,
engine count, configuration), generate at least one query variation that searches for:
- Conditional requirements triggered by those parameters
- Modified or increased requirements for that aircraft type
- Exceptions or scaling factors that apply when a specific threshold is exceeded
This ensures both the base requirement AND any applicable modifier are retrieved.

USER QUESTION: {question}

Respond ONLY with JSON:
{{"queries": ["q1", "q2", "q3", "q4", "q5"], "keywords": ["kw1", "kw2", "kw3", ...]}}"""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0.5,
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}]
            )
            
            content = response.choices[0].message.content.strip()
            
            import json
            result = json.loads(content)
            
            # Ensure original query is included
            if question not in result.get("queries", []):
                result["queries"].insert(0, question)
            
            return result
            
        except Exception as e:
            print(f"Keyword extraction error: {e}")
            return {
                "queries": [question],
                "keywords": question.lower().split()
            }