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
        results = self.vector_store.collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=top_k,
        )

        retrieved_docs = []
        documents = (results.get("documents") or [[]])[0]
        metadatas = (results.get("metadatas") or [[]])[0]
        distances = (results.get("distances") or [[]])[0]
        ids = (results.get("ids") or [[]])[0]
        for rank, (doc_id, document, metadata, distance) in enumerate(
            zip(ids, documents, metadatas, distances), start=1
        ):
            similarity_score = 1 - distance
            if similarity_score >= score_threshold:
                retrieved_docs.append(
                    {
                        "id": doc_id,
                        "content": document,
                        "metadata": metadata,
                        "similarity_score": similarity_score,
                        "distance": distance,
                        "rank": rank,
                    }
                )
        return retrieved_docs
