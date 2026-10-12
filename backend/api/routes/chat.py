import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from api.schemas import ChatQueryRequest, ChatQueryResponse, SourceCitation
from api.services import RAGService

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/query", response_model=ChatQueryResponse)
async def chat_query(request: ChatQueryRequest) -> ChatQueryResponse:
    """Standard non-streaming question answering with citation sources."""
    service = RAGService.get_instance()
    try:
        result = await service.query_chat(
            query=request.query,
            top_k=request.top_k,
            min_score=request.min_score,
            provider=request.provider,
        )
        sources = [
            SourceCitation(
                source=s.get("source", "unknown"),
                page=s.get("page", "unknown"),
                score=round(float(s.get("score", 0.0)), 4),
                preview=s.get("preview", ""),
            )
            for s in result.get("sources", [])
        ]
        return ChatQueryResponse(
            answer=result.get("answer", ""),
            sources=sources,
            confidence=round(float(result.get("confidence", 0.0)), 4),
            context=result.get("context", ""),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Query error: {str(exc)}") from exc


@router.post("/stream")
async def chat_stream(request: ChatQueryRequest) -> StreamingResponse:
    """Stream response tokens in real-time via Server-Sent Events (SSE)."""
    service = RAGService.get_instance()

    try:
        metadata, token_gen = service.stream_chat(
            query=request.query,
            top_k=request.top_k,
            min_score=request.min_score,
            provider=request.provider,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Stream initialization error: {str(exc)}") from exc

    async def event_generator() -> AsyncGenerator[str, None]:
        # 1. Send metadata event immediately
        yield f"event: metadata\ndata: {json.dumps(metadata)}\n\n"
        await asyncio.sleep(0.01)

        # 2. Iterate tokens in thread pool so it doesn't block async event loop
        loop = asyncio.get_event_loop()
        def _get_next():
            try:
                return next(token_gen)
            except StopIteration:
                return None

        while True:
            token = await loop.run_in_executor(None, _get_next)
            if token is None:
                break
            payload = json.dumps({"token": token})
            yield f"event: token\ndata: {payload}\n\n"

        # 3. Send done event
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
