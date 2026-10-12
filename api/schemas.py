from typing import Any, List, Optional
from pydantic import BaseModel, Field


class ChatQueryRequest(BaseModel):
    query: str = Field(..., description="The user question to answer")
    top_k: int = Field(5, ge=1, le=20, description="Number of chunks to retrieve")
    min_score: float = Field(0.2, ge=0.0, le=1.0, description="Minimum similarity score threshold")
    provider: Optional[str] = Field(None, description="Override LLM provider ('gemini' or 'groq')")


class SourceCitation(BaseModel):
    source: str
    page: Any = "unknown"
    score: float
    preview: str


class ChatQueryResponse(BaseModel):
    answer: str
    sources: List[SourceCitation]
    confidence: float
    context: Optional[str] = None


class DocumentItem(BaseModel):
    source: str
    source_name: str
    chunks_count: int
    format: str
    sample_content: str


class DocumentListResponse(BaseModel):
    total_documents: int
    total_chunks: int
    documents: List[DocumentItem]


class IngestUrlRequest(BaseModel):
    url: str
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None


class IngestionResult(BaseModel):
    source: str
    chunks_created: int
    success: bool
    message: str


class DeleteDocumentResponse(BaseModel):
    source: str
    deleted_chunks: int
    success: bool


class VectorStoreStatsResponse(BaseModel):
    backend: str
    collection_name: Optional[str] = None
    directory: Optional[str] = None
    total_chunks: int
    embedding_dimension: int
    embedding_model_id: Optional[str] = None


class SystemConfigResponse(BaseModel):
    llm_provider: str
    gemini_model: str
    groq_model: str
    vector_store_backend: str
    embedding_model: str
    default_chunk_size: int
    default_chunk_overlap: int
    status: str
