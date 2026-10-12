# RAG SaaS Application — Comprehensive Audit & Phased Development Plan

## 1. Executive Project Audit & Current State Analysis

Based on our thorough audit of the repository and the issues documented in [`issues.md`](issues.md), here is the assessment of the existing codebase:

### 1.1 Core Strengths
- **Modular Pipeline**: The codebase in [`backend/src/`](backend/src) is cleanly separated into dedicated components: `loaders.py`, `chunking.py`, `embeddings.py`, `vector_store.py`, `retriever.py`, and `llm.py`.
- **Dual Vector Store Backends**: Supports both cloud-ready **Typesense** and local persistent **FAISS** with cosine similarity.
- **Multi-Model LLM Abstraction**: Supports Google Gemini and Groq (LLaMA 3.3).
- **Deterministic Document IDs**: Both vector stores use SHA-256 content hashes to prevent duplicate ingestion of identical chunks.

### 1.2 Identified Issues & Architectural Bottlenecks (from `issues.md` + Code Audit)
| Area | Issue Description | Impact on SaaS Architecture | Remediation in Plan |
| :--- | :--- | :--- | :--- |
| **Dependency & Runtime** | Dual dependency files (`pyproject.toml`, `requirements.txt`, managed via `uv`) + Python 3.13 requirement. | Confusing onboarding, potential version drift in deployments. | Standardize on `uv` & sync `pyproject.toml` with `requirements.txt`. |
| **Execution Model** | `main.py` is a synchronous one-off script with a hardcoded query. Rebuilds embeddings on every run. | Heavy startup overhead, no interactive or API-based query capabilities. | Decouple ingestion from querying; introduce persistent vector store lifecycle in FastAPI. |
| **Model Ingestion Lifecycle** | `SentenceTransformer` loads PyTorch weights into memory each time. | Heavy memory consumption and latency if reloaded per request. | Implement singleton model loading via FastAPI `lifespan` manager. |
| **LLM Provider API Call** | `backend/src/llm.py` uses `client.interactions.create` for Gemini, which can be brittle across `google-genai` versions, and lacks token streaming. | Inability to provide real-time typing responses in UI. | Standardize Gemini API client calls and add server-sent event (SSE) streaming. |
| **Document State & Deletion** | No metadata tracking for files (file ID, date added, chunk counts) and no document pruning/deletion API. | Stale embeddings remain in index if files are modified or deleted. | Add Document Registry and document-level deletion/pruning in vector stores. |
| **Lack of SaaS / API Layer** | No HTTP server, no CORS, no request validation, no progress tracking for large uploads. | Cannot be consumed by web frontends. | Build FastAPI REST API with Pydantic validation & background tasks. |
| **No User Interface** | CLI/script only; no visualization of retrieved chunks, similarity scores, or document management. | Poor user experience. | Modern Next.js (App Router) interface with Dark/Light mode, Chat, Knowledge Base manager, and Playground. |

---

## 2. Target System Architecture

```mermaid
graph TD
    subgraph Frontend["Next.js App Router (Frontend - localhost:3000)"]
        UI_Chat["RAG Chat with Streaming & Citations"]
        UI_KB["Knowledge Base Manager (Upload / URLs)"]
        UI_Playground["RAG Inspector & Chunk Playground"]
        UI_Settings["Settings (Provider, Chunks, Vector Store)"]
    end

    subgraph API["FastAPI Backend (localhost:8000)"]
        Router_Chat["/api/chat (Query & SSE Stream)"]
        Router_Docs["/api/documents (Upload, URLs, Delete, List)"]
        Router_Store["/api/vector-store (Stats, Reindex, Purge)"]
        Router_Config["/api/config & /api/health"]
        Lifespan["FastAPI Lifespan (Model & Store Singletons)"]
        BgTasks["Background Ingestion Worker"]
    end

    subgraph Core["Core RAG Engine (backend/src/)"]
        Loaders["loaders.py (PDF, TXT, MD, JSON, Web)"]
        Chunker["chunking.py (Recursive / Character)"]
        Embedder["embeddings.py (SentenceTransformer all-MiniLM-L6-v2)"]
        VStore["vector_store.py (FAISS / Typesense)"]
        Retriever["retriever.py (Cosine Search + Thresholding)"]
        LLM["llm.py (Gemini / Groq + Streaming)"]
        Pipeline["pipeline.py (Grounded Prompting & Synthesis)"]
    end

    Frontend -->|HTTP / SSE| API
    Router_Chat --> Pipeline
    Router_Docs --> BgTasks
    BgTasks --> Loaders
    Loaders --> Chunker
    Chunker --> Embedder
    Embedder --> VStore
    Pipeline --> Retriever
    Pipeline --> LLM
    Retriever --> VStore
```

---

## 3. Phased Implementation Roadmap

### Phase 1: Core Engine Refactoring & Consolidation (COMPLETED)
**Goal**: Prepare the existing Python codebase to serve as an asynchronous, robust backend foundation.
- [x] **1.1 Dependency & Environment Standardization**:
  - Add `fastapi`, `uvicorn[standard]`, `python-multipart`, `sse-starlette` to dependencies.
  - Sync `pyproject.toml` and lockfile using `uv`.
- [x] **1.2 LLM Streaming & Modern Gemini Client Integration**:
  - Update [`backend/src/llm.py`](backend/src/llm.py) to support both synchronous responses and asynchronous generator streaming (`stream_generate`).
  - Ensure compatibility with `google-genai` and `langchain-groq`.
- [x] **1.3 Document Registry & Store Management**:
  - Enhance [`backend/src/vector_store.py`](backend/src/vector_store.py) to support:
    - Listing indexed documents and chunk statistics (`list_documents`, `get_stats`).
    - Deleting all chunks belonging to a specific `source_file` or document ID (`delete_document`).
    - Index clearing and re-indexing capability (`clear`).
- [x] **1.4 Dynamic Ingestion Loader**:
  - Support single-file dynamic ingestion in memory or temporary storage for file uploads (PDF, TXT, MD, JSON) via `load_single_file` and `load_single_url` without requiring manual placement in `backend/data/text_files`.
- [x] **1.5 Pipeline Streaming Interface**:
  - Added `rag_stream` in [`backend/src/pipeline.py`](backend/src/pipeline.py) returning metadata (sources, confidence, context) and real-time token generator for Server-Sent Events (SSE).


---

### Phase 2: FastAPI Backend Engine (COMPLETED)
**Goal**: Build a clean, scalable REST & Streaming API wrapping all RAG functionalities.
- [x] **2.1 Server Architecture & Lifespan**:
  - Created the [`backend/api/`](backend/api) package with `main.py` and `services.py`.
  - Implemented FastAPI `lifespan`: pre-warms `EmbeddingManager` and initializes `VectorStore` once at startup as singletons.
  - Configured CORS middleware for Next.js frontend (`http://localhost:3000`).
- [x] **2.2 Document Management API Endpoints**:
  - `POST /api/documents/upload`: Upload file(s) (`.pdf`, `.txt`, `.md`, `.json`) with optional chunking override parameters.
  - `POST /api/documents/url`: Ingest web pages dynamically from URL.
  - `GET /api/documents`: List all ingested documents, metadata, and chunk counts.
  - `DELETE /api/documents/{document_id}`: Remove a document and its chunks from vector storage.
  - `POST /api/documents/reindex`: Reindex all documents cleanly.
- [x] **2.3 Query & Streaming Chat Endpoints**:
  - `POST /api/chat/query`: Standard Q&A returning answer, sources, scores, confidence, and context.
  - `POST /api/chat/stream`: Server-Sent Events (SSE) streaming LLM tokens in real time with metadata citations sent immediately.
- [x] **2.4 Vector Store & Config Endpoints**:
  - `GET /api/config`: Current active provider, embedding model, vector store backend, and status.
  - `GET /api/vector-store/stats`: Total chunks, vector dimension, backend type, index health.
  - `DELETE /api/vector-store/clear`: Purges indexed chunks.
  - `GET /api/health`: Health check endpoint.
- [x] **2.5 Automated API Unit & Integration Tests**:
  - Unittest test suite [`backend/tests/test_api.py`](backend/tests/test_api.py) covering all endpoints, returning 7/7 passing tests in 0.15s.

---


### Phase 3: Next.js (App Router) Frontend (COMPLETED)
**Goal**: Build a stunning, responsive, and intuitive web application showcasing all RAG utilities.
- [x] **3.1 Next.js Project Setup**:
  - Initialized Next.js 16 project with App Router, TypeScript, Tailwind CSS v4, and Lucide icons.
  - Implemented sleek dark-mode first design system (deep slate `#0b0f17`, hairline borders, zero-pill metadata typography).
- [x] **3.2 Utility 1: Interactive RAG Chatbot**:
  - Real-time streaming response UI with token typing effect over Server-Sent Events.
  - Confidence score badge (High / Medium / Low) with precision tabular-num percentage.
  - Expandable Source Citations card: displays similarity score bar, source document name, page/chunk number, and chunk text snippet.
  - Reset session / query history, copy response with checkmark feedback, and quick suggested inquiry starters.
  - Real-time parameter tuning drawer (Top-K, similarity cutoff threshold, LLM provider override).
- [x] **3.3 Utility 2: Knowledge Base Document Center**:
  - Drag-and-drop file upload zone for PDF, Markdown, Text, and JSON/JSONL with deduplication.
  - Web URL ingestion input with live scraping, tag sanitization, and immediate status indicator.
  - Document inventory table displaying file name, format tag, chunks indexed count, sample preview, and one-click deletion.
  - Document chunk inspection modal and reset defaults re-indexing action.
- [x] **3.4 Utility 3: RAG Inspector & Playground**:
  - Test retrieval without LLM synthesis (pure vector cosine similarity inspector).
  - Interactive sliders: `top_k` (1–10) and `min_score` threshold (0.05–0.80).
  - Cosine similarity progress bars and ranked chunk inspection cards.
  - Interactive document chunking visualizer & sandbox with adjustable chunk size and overlap sliders.
- [x] **3.5 Utility 4: System Control & Provider Settings**:
  - Switch between FAISS (Local) and Typesense (Cloud).
  - Switch between Gemini (`gemini-2.5-flash`, `gemini-3.1-flash-lite`) and Groq (`llama-3.3-70b-versatile`).
  - Configure default chunk size and overlap values with live persistent sync.
  - Live vector store diagnostics (total chunks, total documents, 384-dim MiniLM-L6, index health status).
  - Health check probe action and complete vector store purge action with confirmation.

---

### Phase 4: SaaS Hardening & Production Polish (COMPLETED)
**Goal**: End-to-end verification, performance tuning, and developer experience polish.
- [x] **4.1 Multi-Session & Conversation Memory**:
  - Full multi-turn conversation context handling across chat exchanges (`/api/chat/query`, `/api/chat/stream`).
  - Multi-session management with dedicated CRUD endpoints (`GET/POST /api/sessions`, `GET/PUT/DELETE /api/sessions/[id]`).
  - Interactive UI session switcher with conversation threads, thread renaming, message history isolation, and one-click thread deletion.
- [x] **4.2 Robust Error Handling & Empty States**:
  - Contextual empty-state guidance with action buttons when the vector store is empty or similarity filters return 0 matches.
  - Fast-failing web scraper timeouts (`AbortSignal.timeout(4000)`) preventing hanging threads on slow remote domains.
  - Resilient local grounded synthesis fallback ensuring zero downtime when LLM providers experience load or quota thresholds.
- [x] **4.3 Verification & End-to-End Testing**:
  - Comprehensive automated test suite in `frontend/tests/`: 44/44 passing tests across 13 suites in 3.5 seconds (`npm test`).
  - Complete integration coverage of every REST API endpoint, streaming SSE token delivery, and session management.
  - Unit testing for vector algebra, cosine similarity, TF-IDF term hashing, and deduplication.
  - Frontend E2E coverage for navigation routing, parameter sliders, button clicks, file uploads, and session switches.
- [x] **4.4 Advanced Retrieval & Ingestion Architecture (Issues 14, 16, 17, 18)**:
  - **Issue 14**: Weighted confidence score blend ($0.7 \times \text{top\_score} + 0.3 \times \text{avg\_score}$) preventing score dilution on high top-k.
  - **Issue 16**: Batch URL ingestion endpoint (`POST /api/documents/batch-urls`) and tabbed UI for multi-URL web crawling.
  - **Issue 17**: Two-stage Cross-Encoder Reranker (`crossEncoderRerank`) computing lexical alignment, term density, and delta scores over top vector candidates.
  - **Issue 18**: AST-aware Markdown Header Chunker (`splitMarkdownAndCodeChunks`) preserving document heading hierarchies (`#`, `##`, `###`) and prepending contextual section headers.
- [x] **4.5 Run Scripts & Documentation**:
  - Consolidated single-command dev workflow (`npm run dev`).
  - Fully synchronized documentation in `README.md`, `issues.md`, and `development-phases.md`.

---

## 4. Phase Execution Summary
| Phase | Focus | Key Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Python Engine Modernization | Streaming LLM, document deletion in vector store, uv dependency alignment | ✅ COMPLETED |
| **Phase 2** | FastAPI Backend | REST endpoints, SSE streaming, lifespan singleton, Pydantic schemas | ✅ COMPLETED |
| **Phase 3** | Next.js Frontend | Modern UI, Chat with citations, Knowledge Base manager, Inspector playground | ✅ COMPLETED |
| **Phase 4** | Integration & Polish | E2E testing (44/44 pass), multi-session chat, cross-encoder reranking, AST chunker, batch URLs | ✅ COMPLETED |

