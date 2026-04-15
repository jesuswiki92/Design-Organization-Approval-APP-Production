"""
Reranker usando Cohere.
Reordena los resultados de búsqueda por relevancia semántica.
"""

import cohere
from typing import Optional, List
from dataclasses import dataclass
from config import settings


@dataclass
class RerankResult:
    """Resultado de un documento rerankeado."""
    content: str
    metadata: dict
    original_score: float
    rerank_score: float
    index: int
    parent_id: Optional[str] = None
    similarity: float = 0.0  # Alias for compatibility


class CohereReranker:
    """
    Reordena resultados de búsqueda usando Cohere Rerank.
    Mejora la precisión seleccionando los documentos más relevantes.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.COHERE_API_KEY
        
        if not self.api_key:
            raise ValueError("COHERE_API_KEY no está configurada")
        
        self.client = cohere.Client(self.api_key)
        self.model = settings.COHERE_RERANK_MODEL
    
    def rerank(self, query: str, documents: list, top_k: int = 5) -> List[RerankResult]:
        """
        Reordena los documentos según su relevancia para la consulta.
        
        Args:
            query: Pregunta del usuario
            documents: Lista de documentos (dicts con 'content', 'metadata', 'similarity', 'parent_id')
            top_k: Número de documentos a retornar
            
        Returns:
            Lista de RerankResult ordenados por relevancia
        """
        if not documents:
            return []
        
        # Extraer contenidos para el reranker
        texts = [doc.get('content', '') or str(doc) for doc in documents]
        
        try:
            response = self.client.rerank(
                model=self.model,
                query=query,
                documents=texts,
                top_n=min(top_k, len(documents))
            )
            
            results = []
            for item in response.results:
                original_doc = documents[item.index]
                
                results.append(RerankResult(
                    content=original_doc.get('content', ''),
                    metadata=original_doc.get('metadata', {}),
                    original_score=original_doc.get('similarity', 0.0),
                    rerank_score=item.relevance_score,
                    index=item.index,
                    parent_id=original_doc.get('parent_id'),
                    similarity=original_doc.get('similarity', 0.0)
                ))
            
            return results
            
        except Exception as e:
            print(f"Error en reranking: {e}")
            # Si falla, retornar los documentos originales
            return [
                RerankResult(
                    content=doc.get('content', ''),
                    metadata=doc.get('metadata', {}),
                    original_score=doc.get('similarity', 0.0),
                    rerank_score=doc.get('similarity', 0.0),
                    index=i,
                    parent_id=doc.get('parent_id'),
                    similarity=doc.get('similarity', 0.0)
                )
                for i, doc in enumerate(documents[:top_k])
            ]
    
    def rerank_search_results(self, query: str, search_results: list, 
                              top_k: int = 5) -> List[RerankResult]:
        """
        Reordena resultados de SearchResult.
        
        Args:
            query: Pregunta del usuario
            search_results: Lista de SearchResult de Supabase
            top_k: Número de resultados a retornar
            
        Returns:
            Lista de RerankResult
        """
        # Convertir SearchResults a dicts
        documents = [
            {
                'content': result.content,
                'metadata': result.metadata,
                'similarity': result.similarity,
                'parent_id': getattr(result, 'parent_id', None)
            }
            for result in search_results
        ]
        
        return self.rerank(query, documents, top_k)