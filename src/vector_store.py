import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Protocol

import numpy as np
import typesense
from dotenv import load_dotenv
from langchain_core.documents import Document
from typesense.exceptions import ObjectNotFound

from .config import COLLECTION_NAME, FAISS_DIRECTORY


class VectorStoreBackend(Protocol):
    def add_documents(self, documents: List[Document], embeddings: np.ndarray) -> None: ...

    def search(self, query_embedding: np.ndarray, top_k: int) -> List[Dict[str, Any]]: ...


def _document_id(document: Document) -> str:
    serialized = json.dumps(
        {"content": document.page_content, "metadata": document.metadata},
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _faiss_id(document_id: str) -> int:
    return int(document_id[:15], 16)


def _embedding_model_id(model_name: str) -> str:
    return hashlib.sha256(model_name.encode("utf-8")).hexdigest()


class TypesenseVectorStore:
    """Typesense-backed document and vector storage."""

    def __init__(
        self,
        embedding_dimension: int,
        collection_name: str,
        embedding_model_id: str,
    ) -> None:
        host = os.getenv("TYPESENSE_HOST")
        port = os.getenv("TYPESENSE_PORT")
        api_key = os.getenv("TYPESENSE_ADMIN_KEY")
        missing = [
            name
            for name, value in (
                ("TYPESENSE_HOST", host),
                ("TYPESENSE_PORT", port),
                ("TYPESENSE_ADMIN_KEY", api_key),
            )
            if not value
        ]
        if missing:
            raise RuntimeError(
                f"Missing required Typesense configuration: {', '.join(missing)}."
            )

        self.collection_name = collection_name
        self.embedding_dimension = embedding_dimension
        self.embedding_model_id = embedding_model_id
        self.client = typesense.Client(
            {
                "nodes": [
                    {"host": host, "port": port, "protocol": "https"},
                ],
                "api_key": api_key,
                "connection_timeout_seconds": 2,
            }
        )
        self.collection = self.client.collections[collection_name]
        try:
            schema = self.collection.retrieve()
        except ObjectNotFound:
            self.client.collections.create(
                {
                    "name": collection_name,
                    "fields": [
                        {
                            "name": "embedding",
                            "type": "float[]",
                            "num_dim": embedding_dimension,
                            "vec_dist": "cosine",
                        },
                        {"name": "embedding_model", "type": "string"},
                        {"name": "content", "type": "string"},
                        {"name": ".*", "type": "auto"},
                    ],
                }
            )
        else:
            vector_field = next(
                (
                    field
                    for field in schema.get("fields", [])
                    if field.get("name") == "embedding"
                ),
                None,
            )
            if vector_field and vector_field.get("num_dim") != embedding_dimension:
                raise ValueError(
                    "The configured embedding model dimension does not match the "
                    f"Typesense collection {collection_name!r}. Use a new "
                    "TYPESENSE_COLLECTION_NAME for this embedding model."
                )

    def add_documents(self, documents: List[Document], embeddings: np.ndarray) -> None:
        _validate_embeddings(documents, embeddings, self.embedding_dimension)
        records_by_id: Dict[str, Dict[str, Any]] = {}
        for document, embedding in zip(documents, embeddings):
            document_id = _document_id(document)
            records_by_id[document_id] = {
                "id": document_id,
                "content": document.page_content,
                "embedding": embedding.tolist(),
                "embedding_model": self.embedding_model_id,
                "metadata": document.metadata,
            }
        if not records_by_id:
            return

        response = self.collection.documents.import_(
            list(records_by_id.values()),
            {"action": "upsert"},
        )
        failures = [result for result in response if not result.get("success", False)]
        if failures:
            details = "; ".join(
                str(result.get("error", "Unknown Typesense import error"))
                for result in failures[:3]
            )
            raise RuntimeError(
                f"Typesense failed to import {len(failures)} document(s): {details}"
            )

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int,
    ) -> List[Dict[str, Any]]:
        if top_k <= 0:
            raise ValueError("top_k must be positive.")
        if query_embedding.shape[0] != self.embedding_dimension:
            raise ValueError(
                "Query embedding dimension does not match the Typesense collection."
            )

        vector = ",".join(str(float(value)) for value in query_embedding)
        response = self.client.multi_search.perform(
            {
                "searches": [
                    {
                        "collection": self.collection_name,
                        "q": "*",
                        "vector_query": f"embedding:([{vector}], k:{top_k})",
                        "filter_by": f"embedding_model:={self.embedding_model_id}",
                        "per_page": top_k,
                        "exclude_fields": "embedding",
                    }
                ]
            },
            {},
        )
        hits = response["results"][0].get("hits") or []
        return [
            {
                "id": hit["document"]["id"],
                "content": hit["document"]["content"],
                "metadata": hit["document"].get("metadata") or {},
                "distance": float(hit["vector_distance"]),
            }
            for hit in hits
        ]


class FaissVectorStore:
    """Persistent local FAISS vector store using normalized cosine similarity."""

    def __init__(
        self,
        embedding_dimension: int,
        directory: Path,
        embedding_model_id: str,
    ) -> None:
        import faiss

        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.embedding_dimension = embedding_dimension
        self.embedding_model_id = embedding_model_id
        index_file = self.directory / "index.faiss"
        documents_file = self.directory / "documents.json"
        self.index_file = index_file
        self.documents_file = documents_file
        self.faiss = faiss
        self.documents_by_id: Dict[str, Dict[str, Any]] = {}
        self.vector_ids_by_document_id: Dict[str, int] = {}
        if index_file.exists() != documents_file.exists():
            raise RuntimeError(
                f"Incomplete FAISS index found in {self.directory}; restore both "
                "index.faiss and documents.json or choose a different FAISS_DIRECTORY."
            )
        if index_file.exists() and documents_file.exists():
            self.index = faiss.read_index(str(index_file))
            if (
                self.index.d != embedding_dimension
                or self.index.metric_type != faiss.METRIC_INNER_PRODUCT
            ):
                raise ValueError(
                    "The configured embedding model is incompatible with the "
                    f"FAISS index at {self.directory}. Use a different FAISS_DIRECTORY."
                )
            saved_index = json.loads(documents_file.read_text(encoding="utf-8"))
            if saved_index["embedding_model"] != embedding_model_id:
                raise ValueError(
                    "The configured embedding model does not match the FAISS index "
                    f"at {self.directory}. Use a different FAISS_DIRECTORY."
                )
            for saved_document in saved_index["documents"]:
                document_id = saved_document["id"]
                vector_id = int(saved_document["vector_id"])
                self.documents_by_id[document_id] = saved_document["document"]
                self.vector_ids_by_document_id[document_id] = vector_id
        else:
            self.index = faiss.IndexIDMap2(faiss.IndexFlatIP(embedding_dimension))

    def add_documents(self, documents: List[Document], embeddings: np.ndarray) -> None:
        _validate_embeddings(documents, embeddings, self.embedding_dimension)
        unique_documents: Dict[str, tuple[Document, np.ndarray]] = {}
        for document, embedding in zip(documents, embeddings):
            unique_documents[_document_id(document)] = (document, embedding)
        if not unique_documents:
            return

        vector_ids = {
            document_id: _faiss_id(document_id)
            for document_id in unique_documents
        }
        for document_id, vector_id in vector_ids.items():
            existing_id = self.vector_ids_by_document_id.get(document_id)
            if existing_id is not None:
                self.index.remove_ids(np.asarray([existing_id], dtype=np.int64))
            conflicting_document_id = next(
                (
                    existing
                    for existing, existing_vector_id
                    in self.vector_ids_by_document_id.items()
                    if existing_vector_id == vector_id and existing != document_id
                ),
                None,
            )
            if conflicting_document_id is not None:
                raise RuntimeError("FAISS document ID hash collision detected.")

        vectors = np.asarray(
            [embedding for _, embedding in unique_documents.values()],
            dtype=np.float32,
        )
        self.faiss.normalize_L2(vectors)
        self.index.add_with_ids(
            vectors,
            np.asarray(list(vector_ids.values()), dtype=np.int64),
        )
        for document_id, (document, _) in unique_documents.items():
            self.documents_by_id[document_id] = {
                "content": document.page_content,
                "metadata": document.metadata,
            }
            self.vector_ids_by_document_id[document_id] = vector_ids[document_id]
        self._persist()

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int,
    ) -> List[Dict[str, Any]]:
        if top_k <= 0:
            raise ValueError("top_k must be positive.")
        if query_embedding.shape[0] != self.embedding_dimension:
            raise ValueError(
                "Query embedding dimension does not match the FAISS index."
            )

        query = np.asarray(query_embedding, dtype=np.float32).reshape(1, -1)
        self.faiss.normalize_L2(query)
        scores, vector_ids = self.index.search(query, top_k)
        results = []
        for score, vector_id in zip(scores[0], vector_ids[0]):
            if vector_id < 0:
                continue
            document_id = next(
                (
                    key
                    for key, stored_id in self.vector_ids_by_document_id.items()
                    if stored_id == int(vector_id)
                ),
                None,
            )
            if document_id is None:
                raise RuntimeError(f"FAISS index returned unknown vector ID {vector_id}.")
            document = self.documents_by_id[document_id]
            results.append(
                {
                    "id": document_id,
                    "content": document["content"],
                    "metadata": document["metadata"],
                    "distance": 1.0 - float(score),
                }
            )
        return results

    def _persist(self) -> None:
        index_temporary = self.index_file.with_suffix(".faiss.tmp")
        documents_temporary = self.documents_file.with_suffix(".json.tmp")
        self.faiss.write_index(self.index, str(index_temporary))
        documents_temporary.write_text(
            json.dumps(
                {
                    "embedding_model": self.embedding_model_id,
                    "documents": [
                        {
                            "id": document_id,
                            "vector_id": self.vector_ids_by_document_id[document_id],
                            "document": self.documents_by_id[document_id],
                        }
                        for document_id in self.documents_by_id
                    ],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        index_temporary.replace(self.index_file)
        documents_temporary.replace(self.documents_file)


class VectorStore:
    """Configured vector-store facade shared by Typesense and FAISS backends."""

    def __init__(
        self,
        embedding_dimension: int,
        backend: str | None = None,
        collection_name: str | None = None,
        faiss_directory: Path | None = None,
        embedding_model_name: str | None = None,
    ) -> None:
        if embedding_dimension <= 0:
            raise ValueError("Embedding dimension must be positive.")
        load_dotenv()
        embedding_model = embedding_model_name or os.getenv(
            "EMBEDDING_MODEL_NAME",
            "all-MiniLM-L6-v2",
        )
        embedding_model_id = _embedding_model_id(embedding_model)
        backend = (backend or os.getenv("VECTOR_STORE_BACKEND", "typesense")).lower()
        if backend == "typesense":
            self.backend: VectorStoreBackend = TypesenseVectorStore(
                embedding_dimension,
                collection_name
                or os.getenv("TYPESENSE_COLLECTION_NAME", COLLECTION_NAME),
                embedding_model_id,
            )
        elif backend == "faiss":
            self.backend = FaissVectorStore(
                embedding_dimension,
                faiss_directory
                or Path(os.getenv("FAISS_DIRECTORY", str(FAISS_DIRECTORY))),
                embedding_model_id,
            )
        else:
            raise ValueError(
                f"Unsupported vector store backend {backend!r}; "
                "use 'typesense' or 'faiss'."
            )

    def add_documents(self, documents: List[Document], embeddings: np.ndarray) -> None:
        self.backend.add_documents(documents, embeddings)

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int,
    ) -> List[Dict[str, Any]]:
        return self.backend.search(query_embedding, top_k)


def _validate_embeddings(
    documents: List[Document],
    embeddings: np.ndarray,
    embedding_dimension: int,
) -> None:
    if embeddings.ndim != 2 or len(documents) != embeddings.shape[0]:
        raise ValueError("Number of documents and embeddings must match.")
    if embeddings.shape[1] != embedding_dimension:
        raise ValueError("Embedding dimension does not match the vector store.")
