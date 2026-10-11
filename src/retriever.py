from typing import Any, Dict, List

from .embeddings import EmbeddingManager
from .vector_store import VectorStore


class RAGRetriever:
    """Retrieve the most similar chunks from a vector store."""

    def __init__(self, vector_store: VectorStore, embedding_manager: EmbeddingManager) -> None:
        self.vector_store = vector_store
        self.embedding_manager = embedding_manager

    def retrieval(
        self,
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.0,
    ) -> List[Dict[str, Any]]:
        query_embedding = self.embedding_manager.generate_embeddings([query])[0]
        retrieved_docs = []
        results = self.vector_store.search(query_embedding, top_k)
        for rank, item in enumerate(results, start=1):
            distance = item["distance"]
            similarity_score = 1 - distance
            if similarity_score >= score_threshold:
                retrieved_docs.append(
                    {
                        "id": item["id"],
                        "content": item["content"],
                        "metadata": item["metadata"],
                        "similarity_score": similarity_score,
                        "distance": distance,
                        "rank": rank,
                    }
                )
        return retrieved_docs
