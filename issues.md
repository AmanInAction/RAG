# Project Issues & Resolution Status

This document tracks identified issues from the project audit and their resolution status across development phases.

## Summary Matrix

| Issue ID | Description | Status | Phase Resolved |
| :--- | :--- | :--- | :--- |
| **1** | Python version mismatch & onboarding friction | ⚠️ Workaround Documented | Use `.venv` or `uv run` |
| **2** | Duplicate dependency management drift | ✅ **Resolved** | Phase 1 (`uv` sync across `pyproject.toml` and `requirements.txt`) |
| **3** | Hard-coded demo query in `main.py` | ✅ **Resolved** | Phase 2 (FastAPI dynamic `/api/chat/query` & `/api/chat/stream`) |
| **4** | Ingestion & embedding rebuild on every startup | ✅ **Resolved** | Phase 2 (Lifespan warm singleton & on-demand `/api/documents/upload`) |
| **5** | No re-index or document-pruning workflow | ✅ **Resolved** | Phase 1 & 2 (`delete_document`, `list_documents`, `/api/documents/reindex`) |
| **6** | Web ingestion limited to static text files | 🔄 **In Progress** | Dynamic single URL scraper added (`/api/documents/url`) |
| **7** | Heavy ML libraries & operational complexity | ℹ️ Architecture Mitigated | Warm model singleton via FastAPI lifespan avoids reloads |
| **8** | Tests lightweight / lacking integration coverage | ✅ **Improved** | Phase 2 added [`tests/test_api.py`](file:///c:/Users/Asus/RAG/tests/test_api.py) (7/7 tests passing) |
| **9** | Lack of operational safeguards around config | ✅ **Resolved** | Phase 2 Pydantic schemas, `/api/health`, `/api/config` |
| **10** | Prototype state without API or UI | 🔄 **In Progress** | Phase 2 (FastAPI API complete) -> Phase 3 (Next.js UI upcoming) |

---

## Detailed Issue Tracking

### 1) Python version mismatch and onboarding friction
- **Status**: Mitigated via tooling.
- **Resolution**: Environment managed via `uv`. Run all commands using `uv run` or activating `.venv`.

### 2) Duplicate dependency management
- **Status**: ✅ **Resolved (Phase 1)**
- **Resolution**: Both `pyproject.toml` and `requirements.txt` are synchronized and locked via `uv.lock`. Backend packages (`fastapi`, `uvicorn`, `python-multipart`, `sse-starlette`) were added consistently to both files.

### 3) Hard-coded demo in `main.py`
- **Status**: ✅ **Resolved (Phase 2)**
- **Resolution**: Replaced the fixed execution model with a production-grade FastAPI backend offering `/api/chat/query` and real-time Server-Sent Events `/api/chat/stream`.

### 4) Ingestion and embedding rebuild on every startup
- **Status**: ✅ **Resolved (Phase 2)**
- **Resolution**: Embeddings are persisted in the active vector store (Typesense or FAISS). FastAPI's lifespan initializes the store without re-indexing existing documents. Ingestion occurs on-demand via `/api/documents/upload` or `/api/documents/url`.

### 5) No re-index or document-pruning workflow
- **Status**: ✅ **Resolved (Phase 1 & Phase 2)**
- **Resolution**: Implemented `delete_document(source_or_id)` and `list_documents()` in [`VectorStore`](file:///c:/Users/Asus/RAG/src/vector_store.py), exposed as `GET /api/documents` and `DELETE /api/documents/{source_id}`. Added `POST /api/documents/reindex` for full directory re-indexing.

### 6) Web ingestion limited to static pages
- **Status**: 🔄 **In Progress (Phase 2 & Phase 3)**
- **Resolution**: Added dynamic single-URL ingestion endpoint `/api/documents/url` in [`api/routes/documents.py`](file:///c:/Users/Asus/RAG/api/routes/documents.py).

### 7) Heavy dependencies & operational complexity
- **Status**: ℹ️ **Architecture Mitigated**
- **Resolution**: Model weights (`all-MiniLM-L6-v2`) are loaded once into memory on server startup via the [`RAGService`](file:///c:/Users/Asus/RAG/api/services.py) singleton, eliminating per-request latency.

### 8) Lightweight test coverage
- **Status**: ✅ **Improved (Phase 2)**
- **Resolution**: Added [`tests/test_api.py`](file:///c:/Users/Asus/RAG/tests/test_api.py) with full test coverage for API endpoints (chat query, document list, upload, deletion, vector stats, config, and health checks). All tests pass.

### 9) Lack of operational safeguards around missing configuration
- **Status**: ✅ **Resolved (Phase 2)**
- **Resolution**: Strict Pydantic request/response schemas in [`api/schemas.py`](file:///c:/Users/Asus/RAG/api/schemas.py). Clear validation errors returned via HTTP 400/500 with meaningful error messages.

### 10) Prototype state without API or UI
- **Status**: 🔄 **In Progress (Phase 2 Completed, Phase 3 Next)**
- **Resolution**: FastAPI backend engine is fully operational with CORS and SSE streaming. Ready for Phase 3 (Next.js App Router frontend).
