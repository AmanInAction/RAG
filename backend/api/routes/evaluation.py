import asyncio
import json
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from api.services import RAGService
from src.evaluation import REPORT_PATH, load_dataset, run_evaluation, save_dataset

router = APIRouter(prefix="/api/evaluation", tags=["Evaluation"])


class EvaluationDataset(BaseModel):
    name: str = "Custom RAG benchmark"
    cases: list[Dict[str, Any]] = Field(default_factory=list)


class EvaluationRunRequest(BaseModel):
    top_k: int = Field(5, ge=1, le=20)
    min_score: float = Field(0.0, ge=0.0, le=1.0)
    provider: str | None = None


@router.get("/dataset")
async def get_dataset() -> Dict[str, Any]:
    return load_dataset()


@router.put("/dataset")
async def put_dataset(payload: EvaluationDataset) -> Dict[str, Any]:
    try:
        return save_dataset(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/inspect")
async def inspect_retrieval(query: str = Query(..., min_length=1),
                            top_k: int = Query(10, ge=1, le=20)) -> Dict[str, Any]:
    service = RAGService.get_instance()
    try:
        if not service._initialized:
            service.initialize()
        results = await asyncio.to_thread(service.retriever.retrieval, query, top_k, 0.0)
        return {
            "query": query,
            "chunks": [
                {"chunk_id": str(item["id"]), "rank": item["rank"],
                 "similarity_score": round(float(item["similarity_score"]), 4),
                 "source": (item.get("metadata") or {}).get("source_file",
                           (item.get("metadata") or {}).get("source", "unknown")),
                 "content": item["content"]}
                for item in results
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Retrieval inspection failed: {exc}") from exc


@router.post("/run")
async def run_benchmark(request: EvaluationRunRequest) -> Dict[str, Any]:
    service = RAGService.get_instance()
    try:
        if not service._initialized:
            service.initialize()
        provider = request.provider or service.get_config()["llm_provider"]
        llm = service.get_llm(request.provider)
        return await asyncio.to_thread(
            run_evaluation, service.retriever, llm, provider, request.top_k, request.min_score
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {exc}") from exc


@router.get("/latest")
async def latest_report() -> Dict[str, Any]:
    if not REPORT_PATH.exists():
        raise HTTPException(status_code=404, detail="No evaluation report exists yet.")
    return json.loads(REPORT_PATH.read_text(encoding="utf-8"))
