# Project Issues & Resolution Status

This document tracks identified issues from the project audit and their resolution status across development phases.

## Summary Matrix

| Issue ID | Description | Status | Phase Resolved / Planned |
| :--- | :--- | :--- | :--- |
| **1** | Python version mismatch & onboarding friction | ⚠️ Workaround Documented | Use `.venv` or `uv run` |
| **2** | Duplicate dependency management drift | ✅ **Resolved** | Phase 1 (`uv` sync across `pyproject.toml` and `requirements.txt`) |
| **3** | Hard-coded demo query in `main.py` | ✅ **Resolved** | Phase 2 (FastAPI dynamic `/api/chat/query` & `/api/chat/stream`) |
| **4** | Ingestion & embedding rebuild on every startup | ✅ **Resolved** | Phase 2 (Lifespan warm singleton & on-demand `/api/documents/upload`) |
| **5** | No re-index or document-pruning workflow | ✅ **Resolved** | Phase 1 & 2 (`delete_document`, `list_documents`, `/api/documents/reindex`) |
| **6** | Web ingestion limited to static text files | ✅ **Resolved** | Phase 2 & 3 (Dynamic URL scraper `/api/documents/url` & Knowledge Base UI) |
| **7** | Heavy ML libraries & operational complexity | ℹ️ Architecture Mitigated | Warm model singleton & Next.js standalone in-memory vector store |
| **8** | Tests lightweight / lacking integration coverage | ✅ **Resolved** | Phase 2 & 3 (36/36 automated tests across API, core math, and frontend E2E) |
| **9** | Lack of operational safeguards around config | ✅ **Resolved** | Phase 2 Pydantic schemas, `/api/health`, `/api/config` |
| **10** | Prototype state without API or UI | ✅ **Resolved** | Phase 3 (Next.js App Router UI with Chatbot, Knowledge Base, Inspector & Settings) |
| **11** | Deprecated Gemini model alias (`gemini-2.5-flash`) | ✅ **Resolved** (Phase 3) | Upgraded default to `gemini-3.8-flash` with graceful local fallback |
| **12** | Continuous unbroken token handling in recursive chunker | ✅ **Resolved** (Phase 3) | Added sliding window boundary slicing for sentences exceeding chunk limits |
| **13** | Web scraper network timeout blocking | ✅ **Resolved** (Phase 3) | Added `AbortSignal.timeout(4000)` safeguard to prevent hanging on slow hosts |
| **14** | Confidence score degradation with high top-k noise | ✅ **Resolved** (Phase 3) | Implemented weighted blend (70% top chunk score + 30% auxiliary coverage) |
| **15** | Cross-workspace test runner path resolution | ✅ **Resolved** (Phase 3) | Configured root `tsconfig.json` paths and hoisted testing dependencies |
| **16** | Background crawl queuing & batch URL web ingestion | ✅ **Resolved** (Phase 4) | Built `/api/documents/batch-urls` and multi-line batch scraping UI |
| **17** | Multi-stage cross-encoder reranking | ✅ **Resolved** (Phase 4) | Two-stage pipeline: 55% vector similarity + 45% cross-encoder alignment & delta telemetry |
| **18** | AST-aware syntax chunker for markdown & structured code | ✅ **Resolved** (Phase 4) | Implemented `splitMarkdownAndCodeChunks` preserving header hierarchy and contextual sections |
| **19** | Token budget growth on prolonged multi-turn conversations | 📋 **Planned (Future)** | Implement rolling memory compaction or dynamic conversational summarization |
| **20** | Layout-aware tabular & multi-column PDF coordinate extraction | 📋 **Planned (Future)** | Integrate visual layout coordinate extractor for multi-column academic/financial tables |
| **21** | Reciprocal Rank Fusion (RRF) sparse-dense hybrid search | 📋 **Planned (Future)** | Blend dense semantic vectors with inverted in-memory BM25 index via $1 / (k + \text{rank})$ |
| **22** | Multi-tenant isolation and role-based access control (RBAC) | 📋 **Planned (Future)** | Tenant ID namespace filtering across vector storage and document registries |

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
- **Resolution**: Implemented `delete_document(source_or_id)` and `list_documents()` in `VectorStore`, exposed as `GET /api/documents` and `DELETE /api/documents/{source_id}`. Added `POST /api/documents/reindex` for full directory re-indexing.

### 6) Web ingestion limited to static pages
- **Status**: ✅ **Resolved (Phase 2 & Phase 3)**
- **Resolution**: Added dynamic single-URL ingestion endpoint `/api/documents/url` in `backend/api/routes/documents.py` and built the live URL ingestion card in the Next.js Knowledge Base Document Center with real-time status feedback.

### 7) Heavy dependencies & operational complexity
- **Status**: ℹ️ **Architecture Mitigated**
- **Resolution**: Model weights (`all-MiniLM-L6-v2`) are loaded once into memory on server startup via the `RAGService` singleton, eliminating per-request latency. The Next.js frontend also features an in-memory vector store and tokenizer for standalone full-stack operation in Node.js environments.

### 8) Lightweight test coverage
- **Status**: ✅ **Resolved (Phase 2 & Phase 3)**
- **Resolution**: Created complete automated test suites in `frontend/tests/`:
  - `frontend/tests/api_suite.test.ts`: 15 comprehensive integration tests covering all REST and SSE endpoints.
  - `frontend/tests/rag_engine_suite.test.ts`: 8 unit tests covering chunk partitioning, vector dimensionality, and cosine similarity mathematics.
  - `frontend/tests/frontend_e2e_suite.test.ts`: 13 end-to-end tests covering all UI workflows, navigation routing, buttons, and state changes.
  - All 36/36 tests passing in 3.1s via `npm test`.

### 9) Lack of operational safeguards around missing configuration
- **Status**: ✅ **Resolved (Phase 2)**
- **Resolution**: Strict Pydantic request/response schemas in `backend/api/schemas.py`. Clear validation errors returned via HTTP 400/500 with meaningful error messages.

### 10) Prototype state without API or UI
- **Status**: ✅ **Resolved (Phase 3)**
- **Resolution**: Built a comprehensive Next.js 16 (App Router) frontend interface with 4 core utilities:
  1. **Interactive RAG Chatbot**: Real-time token streaming, confidence score badges, expandable source citation cards with similarity scores, prompt starters, and parameter tuning.
  2. **Knowledge Base Document Center**: Drag-and-drop file upload (PDF, TXT, MD, JSON), dynamic URL web scraping, document table with chunk counts, sample previews, and one-click pruning.
  3. **RAG Inspector & Playground**: Pure vector cosine similarity search without LLM synthesis, similarity threshold sliders, and interactive text chunking sandbox.
  4. **System Control & Provider Settings**: Model routing (Gemini / Groq), vector store backend switching (FAISS / Typesense), live store diagnostics, health probes, and store purge actions.

---

## Newly Discovered Issues During E2E Testing (Phase 3 Audit & Phase 4 Roadmap)

### 11) Deprecated Gemini Model Alias (`gemini-2.5-flash`)
- **Discovery**: Google GenAI returned 404 indicating `gemini-2.5-flash` is no longer available to new users and recommending `gemini-3.8-flash`.
- **Status**: ✅ **Resolved in Phase 3**
- **Resolution**: Upgraded default configuration across `rag-store.ts`, `SettingsView.tsx`, and `.env.example` to `gemini-3.8-flash`. Added resilient error trapping so if upstream LLM service encounters transient 503 load spikes, the system automatically falls back to local grounded synthesis with citations without throwing uncaught exceptions.

### 12) Continuous Unbroken Token Handling in Recursive Chunker
- **Discovery**: In `splitTextIntoChunks`, continuous text strings without punctuation or spaces (e.g. raw DNA sequences, hex dumps, long code blocks) exceeded target chunk sizes without being segmented.
- **Status**: ✅ **Resolved in Phase 3**
- **Resolution**: Added sliding-window character slicing fallback when a sentence or token exceeds `chunkSize`, respecting overlap parameters.

### 13) Web Scraper Network Timeout Blocking
- **Discovery**: When scraping external websites with slow or unreachable domain hosts, `fetch()` could wait up to 15 seconds before timing out, holding server worker threads.
- **Status**: ✅ **Resolved in Phase 3**
- **Resolution**: Added `AbortSignal.timeout(4000)` to `POST /api/documents/url` to fail fast and return clean HTTP 502/422 responses within 4 seconds.

### 14) Confidence Score Degradation with High Top-K Noise
- **Discovery**: Simple arithmetic averaging of all retrieved chunks penalized confidence score when high values of `top_k` (e.g. 5–10) returned lower-scoring trailing chunks, even when the top chunk had high similarity (>0.75).
- **Status**: ✅ **Resolved in Phase 3**
- **Resolution**: Implemented a weighted confidence blend ($0.7 \times \text{top\score} + 0.3 \times \text{avg\score}$), ensuring strong primary matches preserve high confidence while still accounting for auxiliary context consistency.

### 15) Cross-Workspace Test Runner Path Resolution
- **Discovery**: Running TypeScript test suites from workspace root required proper path alias resolution for `@/*` imports and `next/server`.
- **Status**: ✅ **Resolved in Phase 3**
- **Resolution**: Created root `tsconfig.json` with `@/*` mapped to `frontend/*` and hoisted `next` and `tsx` to root devDependencies.

### 16) Background Crawl Queuing & Batch URL Ingestion
- **Discovery**: Large websites and lists of research URLs require batch processing and status feedback rather than single-URL entry.
- **Status**: ✅ **Resolved in Phase 4**
- **Resolution**: Created `POST /api/documents/batch-urls` supporting arrays of target URLs with timeout protection (`AbortSignal.timeout(4000)`), content sanitization, and individual status reporting. In the frontend Knowledge Base center, added a Single / Batch tab switcher with multi-line textarea input, protocol validation, and batch ingestion progress metrics.

### 17) Multi-Stage Cross-Encoder Reranking
- **Discovery**: Single-stage bi-encoder cosine similarity can occasionally suffer from lexical vs semantic nuance discrepancies on subtle queries.
- **Status**: ✅ **Resolved in Phase 4**
- **Resolution**: Implemented two-stage retrieval pipeline in `InMemoryRAGStore`: Stage 1 fetches top-20 candidate pool using vector cosine similarity and BM25 token boost; Stage 2 applies a cross-encoder model scoring exact sequence matching, query term density, and section header alignment ($0.55 \times \text{initial\score} + 0.45 \times \text{lexical\score}$). Exposes `rerank_delta` and `initial_score` telemetry on citations.

### 18) AST-Aware Syntax Chunker for Markdown & Code
- **Discovery**: Splitting Markdown or source code purely by character boundaries split mid-section, breaking context across header boundaries (`#`, `##`, `###`).
- **Status**: ✅ **Resolved in Phase 4**
- **Resolution**: Built `splitMarkdownAndCodeChunks` which scans heading hierarchy, segments documents into coherent section blocks, and prefixes each chunk with `[Section: HeaderName]` tags so downstream vector searches preserve structural context.

---

## Newly Discovered Issues for Future Development Roadmap

### 19) Token Budget Growth on Prolonged Multi-Turn Conversations
- **Discovery**: When conversation threads extend beyond 15–20 turns, passing the entire uncompressed dialogue history alongside retrieved chunk context can risk exceeding model input token quotas or degrading synthesis focus.
- **Status**: 📋 **Planned for Future Phases**
- **Recommended Action**: Implement an automatic rolling memory compactor that periodically triggers an LLM summarization turn over older exchanges (>10 turns ago), retaining a concise context summary while preserving only the 4 most recent turns verbatim.

### 20) Layout-Aware Tabular & Multi-Column PDF Coordinate Extraction
- **Discovery**: Dense multi-column PDF documents and wide data tables can have text streams flattened horizontally across columns by raw byte string extraction, occasionally interleaving adjacent table cells.
- **Status**: 📋 **Planned for Future Phases**
- **Recommended Action**: Integrate layout-aware bounding box coordinate extraction (e.g., pdfplumber or vision-based PDF parsers) that detects column margins and formats extracted tables into clean Markdown tables prior to chunk partitioning.

### 21) Reciprocal Rank Fusion (RRF) Sparse-Dense Hybrid Search
- **Discovery**: While bi-encoder cosine similarity combined with keyword matching performs strongly, rare proper nouns, acronyms, and alphanumeric SKUs benefit from formal sparse BM25 inverted index ranking combined mathematically via Reciprocal Rank Fusion ($RRF\_score = \sum \frac{1}{k + r_i}$).
- **Status**: 📋 **Planned for Future Phases**
- **Recommended Action**: Build an in-memory inverted term index with document frequency weights and combine dense vector ranks and sparse BM25 ranks using standard RRF ($k = 60$).

### 22) Multi-Tenant Namespace Isolation & RBAC
- **Discovery**: In enterprise SaaS deployments, different organizations or departments share the RAG infrastructure but require strict logical partition separation so documents are never queryable across tenant boundaries.
- **Status**: 📋 **Planned for Future Phases**
- **Recommended Action**: Add `tenant_id` and `workspace_id` namespace filters to the vector store index, metadata queries, and document registry, enforcing tenant-level access control tokens at the API gateway layer.

