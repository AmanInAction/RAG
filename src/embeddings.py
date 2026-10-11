import os
from typing import Any, List

import numpy as np
from dotenv import load_dotenv
from langchain_core.embeddings import Embeddings
from sentence_transformers import SentenceTransformer

from .config import EMBEDDING_MODEL_NAME


class EmbeddingManager(Embeddings):
    """Load a sentence-transformer model and generate embeddings in batches."""

    def __init__(self, model_name: str | None = None) -> None:
        load_dotenv()
        model_name = model_name or os.getenv("EMBEDDING_MODEL_NAME", EMBEDDING_MODEL_NAME)
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        embedding_dimension = self.model.get_embedding_dimension()
        if embedding_dimension is None:
            raise RuntimeError(f"Embedding model {model_name} reported no dimension.")
        self.embedding_dimension = embedding_dimension
        print(
            f"Model {model_name} loaded successfully. "
            f"Embedding dimension: {self.embedding_dimension}"
        )

    @staticmethod
    def _extract_text(item: Any) -> str | None:
        if item is None:
            return None
        if hasattr(item, "page_content"):
            return item.page_content
        if hasattr(item, "text"):
            return item.text
        if isinstance(item, dict):
            return item.get("text", item.get("page_content", str(item)))
        return str(item)

    def generate_embeddings(self, texts: Any) -> np.ndarray:
        """Embed strings, LangChain documents, dictionaries, or nested sequences."""
        if isinstance(texts, str) or hasattr(texts, "page_content") or hasattr(texts, "text"):
            texts = [texts]

        clean_texts: List[str] = []
        for item in texts:
            items = item if isinstance(item, (list, tuple, np.ndarray)) else [item]
            for nested_item in items:
                text = self._extract_text(nested_item)
                if text and text.strip():
                    clean_texts.append(text.strip())

        if not clean_texts:
            return np.empty((0, self.embedding_dimension))

        batches = []
        for start in range(0, len(clean_texts), 64):
            batches.append(
                self.model.encode(
                    clean_texts[start : start + 64],
                    show_progress_bar=False,
                    convert_to_numpy=True,
                )
            )
        return np.vstack(batches)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return self.generate_embeddings(texts).tolist()

    def embed_query(self, text: str) -> List[float]:
        return self.generate_embeddings([text])[0].tolist()
