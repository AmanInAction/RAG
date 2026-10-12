from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes.chat import router as chat_router
from api.routes.documents import router as documents_router
from api.routes.system import router as system_router
from api.services import RAGService


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Pre-warm embedding models and initialize vector store on startup."""
    print("Starting up FastAPI application...", flush=True)
    service = RAGService.get_instance()
    try:
        service.initialize()
    except Exception as exc:
        print(f"Warning during startup initialization: {exc}", flush=True)
    yield
    print("Shutting down FastAPI application...", flush=True)


app = FastAPI(
    title="RAG SaaS Backend API",
    description="Scalable FastAPI backend powering dynamic document ingestion, vector retrieval, and LLM streaming.",
    version="0.1.0",
    lifespan=lifespan,
)

# Enable CORS for Next.js App Router (localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(system_router)


@app.get("/")
async def root():
    return JSONResponse(
        {
            "name": "RAG SaaS API",
            "version": "0.1.0",
            "docs_url": "/docs",
            "health_url": "/api/health",
        }
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
