from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from api.schemas import SystemConfigResponse, VectorStoreStatsResponse
from api.services import RAGService

router = APIRouter(prefix="/api", tags=["System"])


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "ok", "service": "rag-saas-api"}


@router.get("/config", response_model=SystemConfigResponse)
async def get_system_config() -> SystemConfigResponse:
    """Return active LLM provider, vector backend, and chunk settings."""
    service = RAGService.get_instance()
    cfg = service.get_config()
    return SystemConfigResponse(
        llm_provider=cfg["llm_provider"],
        gemini_model=cfg["gemini_model"],
        groq_model=cfg["groq_model"],
        vector_store_backend=cfg["vector_store_backend"],
        embedding_model=cfg["embedding_model"],
        default_chunk_size=cfg["default_chunk_size"],
        default_chunk_overlap=cfg["default_chunk_overlap"],
        status=cfg["status"],
    )


@router.get("/vector-store/stats", response_model=VectorStoreStatsResponse)
async def get_vector_store_stats() -> VectorStoreStatsResponse:
    """Return vector store stats (total chunks, backend, dimension)."""
    service = RAGService.get_instance()
    try:
        stats = await service.get_stats()
        return VectorStoreStatsResponse(
            backend=stats.get("backend", "unknown"),
            collection_name=stats.get("collection_name"),
            directory=stats.get("directory"),
            total_chunks=stats.get("total_chunks", 0),
            embedding_dimension=stats.get("embedding_dimension", 384),
            embedding_model_id=stats.get("embedding_model_id"),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch store stats: {str(exc)}") from exc


@router.delete("/vector-store/clear")
async def clear_vector_store() -> Dict[str, Any]:
    """Purge all indexed documents from the active vector store."""
    service = RAGService.get_instance()
    try:
        await service.clear_store()
        return {"success": True, "message": "Vector store successfully purged."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to clear store: {str(exc)}") from exc
