import asyncio
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple

from dotenv import load_dotenv

from src.chunking import split_documents
from src.config import (
    DEFAULT_CHUNK_OVERLAP,
    DEFAULT_CHUNK_SIZE,
    EMBEDDING_MODEL_NAME,
    GEMINI_MODEL_NAME,
    GROQ_MODEL_NAME,
)
from src.embeddings import EmbeddingManager
from src.llm import LLMProvider
from src.loaders import load_single_file, load_single_url
from src.pipeline import rag_advanced, rag_stream
from src.retriever import RAGRetriever
from src.vector_store import VectorStore


class RAGService:
    """Singleton service managing warm RAG models, vector store, and ingestion."""

    _instance: Optional["RAGService"] = None

    def __init__(self) -> None:
        load_dotenv()
        self.embedding_manager: Optional[EmbeddingManager] = None
        self.vector_store: Optional[VectorStore] = None
        self.retriever: Optional[RAGRetriever] = None
        self.default_llm: Optional[LLMProvider] = None
        self._initialized = False

    @classmethod
    def get_instance(cls) -> "RAGService":
        if cls._instance is None:
            cls._instance = RAGService()
        return cls._instance

    def initialize(self) -> None:
        """Initialize and warm up embedding manager, vector store, and LLM provider."""
        if self._initialized:
            return

        print("Initializing RAG Service singletons...", flush=True)
        # 1. Warm embedding manager
        self.embedding_manager = EmbeddingManager()

        # 2. Initialize vector store (Typesense by default as configured)
        backend = os.getenv("VECTOR_STORE_BACKEND", "typesense")
        self.vector_store = VectorStore(
            embedding_dimension=self.embedding_manager.embedding_dimension,
            backend=backend,
            embedding_model_name=self.embedding_manager.model_name,
        )

        # 3. Create retriever facade
        self.retriever = RAGRetriever(self.vector_store, self.embedding_manager)

        # 4. Initialize LLM Provider
        try:
            self.default_llm = LLMProvider()
        except Exception as e:
            print(f"Warning: Default LLM initialization deferred: {e}", flush=True)
            self.default_llm = None

        self._initialized = True
        print(f"RAG Service initialized successfully with backend: {backend}", flush=True)

    def get_llm(self, provider_override: Optional[str] = None) -> LLMProvider:
        if provider_override:
            return LLMProvider(provider=provider_override)
        if self.default_llm is None:
            self.default_llm = LLMProvider()
        return self.default_llm

    async def query_chat(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.2,
        provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Perform non-streaming RAG query."""
        if not self._initialized:
            self.initialize()

        llm = self.get_llm(provider)

        def _run_query():
            return rag_advanced(
                query=query,
                retriever=self.retriever,
                llm=llm,
                top_k=top_k,
                min_score=min_score,
                return_context=True,
            )

        return await asyncio.to_thread(_run_query)

    def stream_chat(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.2,
        provider: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], Iterator[str]]:
        """Return metadata and token generator for real-time streaming."""
        if not self._initialized:
            self.initialize()

        llm = self.get_llm(provider)
        return rag_stream(
            query=query,
            retriever=self.retriever,
            llm=llm,
            top_k=top_k,
            min_score=min_score,
        )

    async def ingest_file(
        self,
        file_path: Path,
        original_filename: str,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ) -> int:
        """Ingest a single document file into the active vector store."""
        if not self._initialized:
            self.initialize()

        def _do_ingest() -> int:
            documents = load_single_file(file_path, original_filename)
            chunks = split_documents(
                documents,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )
            if not chunks:
                return 0
            embeddings = self.embedding_manager.generate_embeddings(chunks)
            self.vector_store.add_documents(chunks, embeddings)
            return len(chunks)

        return await asyncio.to_thread(_do_ingest)

    async def ingest_url(
        self,
        url: str,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ) -> int:
        """Ingest a web URL into the active vector store."""
        if not self._initialized:
            self.initialize()

        def _do_ingest() -> int:
            documents = load_single_url(url)
            chunks = split_documents(
                documents,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )
            if not chunks:
                return 0
            embeddings = self.embedding_manager.generate_embeddings(chunks)
            self.vector_store.add_documents(chunks, embeddings)
            return len(chunks)

        return await asyncio.to_thread(_do_ingest)

    async def list_documents(self) -> List[Dict[str, Any]]:
        """List distinct documents stored in vector store."""
        if not self._initialized:
            self.initialize()
        return await asyncio.to_thread(self.vector_store.list_documents)

    async def delete_document(self, source_or_id: str) -> int:
        """Delete document from vector store."""
        if not self._initialized:
            self.initialize()
        return await asyncio.to_thread(self.vector_store.delete_document, source_or_id)

    async def get_stats(self) -> Dict[str, Any]:
        """Return vector store stats."""
        if not self._initialized:
            self.initialize()
        return await asyncio.to_thread(self.vector_store.get_stats)

    async def clear_store(self) -> None:
        """Clear all indexed documents."""
        if not self._initialized:
            self.initialize()
        await asyncio.to_thread(self.vector_store.clear)

    def get_config(self) -> Dict[str, Any]:
        load_dotenv()
        return {
            "llm_provider": os.getenv("LLM_PROVIDER", "gemini"),
            "gemini_model": os.getenv("GEMINI_MODEL_NAME", GEMINI_MODEL_NAME),
            "groq_model": os.getenv("GROQ_MODEL_NAME", GROQ_MODEL_NAME),
            "vector_store_backend": os.getenv("VECTOR_STORE_BACKEND", "typesense"),
            "embedding_model": os.getenv("EMBEDDING_MODEL_NAME", EMBEDDING_MODEL_NAME),
            "default_chunk_size": int(os.getenv("CHUNK_SIZE", str(DEFAULT_CHUNK_SIZE))),
            "default_chunk_overlap": int(os.getenv("CHUNK_OVERLAP", str(DEFAULT_CHUNK_OVERLAP))),
            "status": "online" if self._initialized else "pending_initialization",
        }
