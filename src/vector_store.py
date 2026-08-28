from pathlib import Path
from typing import List
from uuid import uuid4

import chromadb
import numpy as np
from chromadb.config import Settings
from langchain_core.documents import Document

from .config import COLLECTION_NAME, VECTOR_STORE_DIRECTORY


class VectorStore:
    """Persistent Chroma collection for document chunks and embeddings."""

    def __init__(
        self,
        collection_name: str = COLLECTION_NAME,
        persist_directory: Path = VECTOR_STORE_DIRECTORY,
    ) -> None:
        self.collection_name = collection_name
        self.persist_directory = Path(persist_directory)
        self.persist_directory.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=str(self.persist_directory),
            settings=Settings(allow_reset=True),
        )
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={
                "description": "Collection of document embeddings",
                "hnsw:space": "cosine",
            },
        )
        print(
            f"ChromaDB collection '{collection_name}' initialized successfully. "
            f"Existing documents: {self.collection.count()}"
        )

    def add_documents(self, documents: List[Document], embeddings: np.ndarray) -> None:
        if len(documents) != embeddings.shape[0]:
            raise ValueError("Number of documents and embeddings must match.")
        if not documents:
            print("No documents to add.")
            return

        ids = []
        metadatas = []
        document_texts = []
        embedding_values = []
        for index, (document, embedding) in enumerate(zip(documents, embeddings)):
            ids.append(f"doc_{uuid4().hex[:8]}_{index}")
            metadata = dict(document.metadata)
            metadata["doc_index"] = index
            metadata["content_length"] = len(document.page_content)
            metadatas.append(metadata)
            document_texts.append(document.page_content)
            embedding_values.append(embedding.tolist())

        self.collection.add(
            ids=ids,
            embeddings=embedding_values,
            metadatas=metadatas,
            documents=document_texts,
        )
        print(f"Added {len(documents)} documents to '{self.collection_name}'.")
