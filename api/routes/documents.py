import shutil
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from api.schemas import (
    DeleteDocumentResponse,
    DocumentItem,
    DocumentListResponse,
    IngestUrlRequest,
    IngestionResult,
)
from api.services import RAGService
from src.config import TEXTS_DIRECTORY, WEB_URLS_FILE
from src.loaders import load_documents

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.get("", response_model=DocumentListResponse)
async def list_documents() -> DocumentListResponse:
    """List all ingested documents and their chunk counts."""
    service = RAGService.get_instance()
    try:
        raw_docs = await service.list_documents()
        items = [
            DocumentItem(
                source=doc.get("source", ""),
                source_name=doc.get("source_name", doc.get("source", "")),
                chunks_count=doc.get("chunks_count", 0),
                format=doc.get("format", "text"),
                sample_content=doc.get("sample_content", ""),
            )
            for doc in raw_docs
        ]
        total_chunks = sum(item.chunks_count for item in items)
        return DocumentListResponse(
            total_documents=len(items),
            total_chunks=total_chunks,
            documents=items,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {str(exc)}") from exc


@router.post("/upload", response_model=IngestionResult)
async def upload_document(
    file: UploadFile = File(...),
    chunk_size: Optional[int] = Form(None),
    chunk_overlap: Optional[int] = Form(None),
) -> IngestionResult:
    """Upload and ingest a document file (.pdf, .txt, .md, .json)."""
    service = RAGService.get_instance()
    original_name = file.filename or "uploaded_document"
    suffix = Path(original_name).suffix.lower()

    if suffix not in {".txt", ".md", ".markdown", ".json", ".pdf"}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{suffix}'. Allowed: .txt, .md, .json, .pdf",
        )

    # Save to a temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = Path(temp_file.name)
        shutil.copyfileobj(file.file, temp_file)

    try:
        chunks_count = await service.ingest_file(
            file_path=temp_path,
            original_filename=original_name,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        return IngestionResult(
            source=original_name,
            chunks_created=chunks_count,
            success=True,
            message=f"Successfully indexed '{original_name}' into {chunks_count} chunks.",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to ingest file: {str(exc)}") from exc
    finally:
        if temp_path.exists():
            temp_path.unlink()


@router.post("/url", response_model=IngestionResult)
async def ingest_url(request: IngestUrlRequest) -> IngestionResult:
    """Ingest static web page content from a URL."""
    service = RAGService.get_instance()
    try:
        chunks_count = await service.ingest_url(
            url=request.url,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
        )
        return IngestionResult(
            source=request.url,
            chunks_created=chunks_count,
            success=True,
            message=f"Successfully indexed URL '{request.url}' into {chunks_count} chunks.",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to ingest URL: {str(exc)}") from exc


@router.delete("/{source_id:path}", response_model=DeleteDocumentResponse)
async def delete_document(source_id: str) -> DeleteDocumentResponse:
    """Delete a document and all its chunks from the vector store."""
    service = RAGService.get_instance()
    try:
        deleted = await service.delete_document(source_id)
        return DeleteDocumentResponse(
            source=source_id,
            deleted_chunks=deleted,
            success=deleted > 0,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(exc)}") from exc


@router.post("/reindex", response_model=IngestionResult)
async def reindex_default_directory() -> IngestionResult:
    """Re-index all documents in the default data directory."""
    service = RAGService.get_instance()
    try:
        if not service._initialized:
            service.initialize()

        # 1. Load documents
        urls_file = WEB_URLS_FILE if WEB_URLS_FILE.exists() else None
        documents = load_documents(TEXTS_DIRECTORY, urls_file)
        if not documents:
            return IngestionResult(
                source=str(TEXTS_DIRECTORY),
                chunks_created=0,
                success=True,
                message="No documents found to reindex.",
            )

        # 2. Split chunks
        from src.chunking import split_documents
        chunks = split_documents(documents)

        # 3. Embed & upsert
        embeddings = service.embedding_manager.generate_embeddings(chunks)
        service.vector_store.add_documents(chunks, embeddings)

        return IngestionResult(
            source=str(TEXTS_DIRECTORY),
            chunks_created=len(chunks),
            success=True,
            message=f"Reindexed {len(documents)} source documents into {len(chunks)} chunks.",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Reindex failed: {str(exc)}") from exc
