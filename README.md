# RAG SaaS Platform

A high-performance, modular Retrieval-Augmented Generation (RAG) platform with a **FastAPI backend** and upcoming **Next.js App Router frontend**. It enables dynamic document ingestion (PDF, Markdown, Text, JSON), web page scraping, semantic retrieval via **Typesense** or local **FAISS**, and streaming token responses via **Google Gemini** or **Groq**.

---

## Architecture Overview

```text
.
├── api/                      # FastAPI Backend Server
│   ├── main.py               # Lifespan singletons, CORS, server entrypoint
│   ├── routes/               # REST & SSE routers
│   │   ├── chat.py           # /api/chat/query & /api/chat/stream (SSE)
│   │   ├── documents.py      # /api/documents (upload, url, list, delete, reindex)
│   │   └── system.py         # /api/config, /api/health, /api/vector-store/stats
│   ├── schemas.py            # Pydantic request & response models
│   └── services.py           # RAGService singleton & async workers
├── src/                      # Core RAG Engine
│   ├── chunking.py           # Recursive & Character chunk splitters
│   ├── config.py             # Default paths and model settings
│   ├── embeddings.py         # SentenceTransformer (all-MiniLM-L6-v2)
│   ├── llm.py                # Gemini & Groq multi-provider + token streaming
│   ├── loaders.py            # Local file & web loader interfaces
│   ├── pipeline.py           # Prompting, advanced RAG & streaming generator
│   ├── retriever.py          # Vector similarity search & thresholding
│   └── vector_store.py       # Typesense and local FAISS vector backends
├── tests/                    # Automated Test Suite
│   ├── test_api.py           # FastAPI integration tests
│   └── test_configurable_pipeline.py # Unit tests
├── pyproject.toml            # Project dependencies & metadata (uv managed)
├── requirements.txt          # Pip requirements sync
└── development-phases.md     # Phased development roadmap
```

---

## Backend API Endpoints

The FastAPI server runs on `http://localhost:8000` with interactive Swagger docs at `/docs`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/chat/stream` | Server-Sent Events (SSE) streaming LLM answer with immediate citation metadata. |
| `POST` | `/api/chat/query` | Standard Q&A returning answer, sources, confidence, and context. |
| `POST` | `/api/documents/upload` | Upload `.pdf`, `.txt`, `.md`, or `.json` file for dynamic ingestion. |
| `POST` | `/api/documents/url` | Ingest and index content from a public web URL. |
| `GET` | `/api/documents` | List all ingested documents with chunk counts and sample snippets. |
| `DELETE` | `/api/documents/{id}` | Delete a document and its indexed chunks. |
| `POST` | `/api/documents/reindex` | Re-index all documents in the default directory. |
| `GET` | `/api/vector-store/stats` | View active collection stats, vector dimensions, and chunk count. |
| `DELETE` | `/api/vector-store/clear` | Purge all indexed vectors. |
| `GET` | `/api/config` | View active provider, embedding model, and chunk parameters. |
| `GET` | `/api/health` | Health check probe. |

---

## Setup & Quickstart

### Prerequisites
- Python 3.13+
- [`uv`](https://docs.astral.sh/uv/) package manager (or standard virtualenv)
- Node.js 18+ (for upcoming frontend)

### Installation
```powershell
# Clone the repository
git clone <repo-url>
cd RAG

# Install dependencies with uv
uv sync
```

### Environment Configuration
Create a `.env` file in the root directory:
```env
# LLM Providers (Gemini or Groq)
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL_NAME=gemini-3.1-flash-lite

# Optional Groq configuration
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL_NAME=llama-3.3-70b-versatile

# Vector Store (typesense or faiss)
VECTOR_STORE_BACKEND=typesense
TYPESENSE_HOST=your-typesense-host
TYPESENSE_PORT=443
TYPESENSE_ADMIN_KEY=your-typesense-admin-key
TYPESENSE_COLLECTION_NAME=document_embeddings

# Chunking & Embeddings
EMBEDDING_MODEL_NAME=all-MiniLM-L6-v2
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

---

## Running the Application

### 1. Start the FastAPI Backend Server
```powershell
uv run uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive API docs are available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 2. Run Automated Tests
```powershell
uv run python -m unittest tests/test_api.py
```

---

## Project Status

- **Phase 1: Core Engine Refactoring & Consolidation**: Completed
- **Phase 2: FastAPI Backend Engine**: Completed
- **Phase 3: Next.js (App Router) Frontend (`frontend/`)**: Up Next
- **Phase 4: SaaS Hardening & Production Polish**: Planned
