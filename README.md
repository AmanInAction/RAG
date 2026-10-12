# RAG SaaS Platform

A high-performance, modular Retrieval-Augmented Generation (RAG) platform featuring a **Next.js 16 (App Router) user interface** and a scalable **FastAPI backend**. It enables dynamic multi-format document ingestion (PDF, Markdown, Text, JSON), web page scraping, semantic retrieval via **FAISS** or cloud **Typesense**, real-time token streaming via **Google Gemini** or **Groq**, and an interactive vector inspection playground.

---

## Key Features & UI Utilities

### 1. Interactive RAG Chatbot
- **Live Token Streaming**: Real-time typing response via Server-Sent Events (SSE).
- **Multi-Session Conversation Threads**: Manage isolated conversation sessions, create new threads, rename sessions, and track multi-turn dialogue memory.
- **Grounded Source Citations**: Expandable citation cards showing source document, page/chunk number, cross-encoder rerank delta, similarity match percentage, and raw text preview.
- **Two-Stage Cross-Encoder Reranking**: Combines dense vector similarity with lexical term sequence and density scoring.
- **Confidence Scoring**: High / Medium / Low confidence badges computed from weighted blend ($0.7 \times \text{top\_score} + 0.3 \times \text{avg\_score}$).
- **Dynamic Parameter Tuning**: Drawer for overriding Top-K chunks, similarity thresholds, and LLM provider in flight.
- **Convenience Actions**: Copy answer with checkmark feedback, one-click prompt inquiry starters, and session reset.

### 2. Knowledge Base Document Center
- **Drag-and-Drop Ingestion**: Upload `.pdf`, `.txt`, `.md`, `.json`, `.jsonl` files with automatic text extraction and chunk deduplication.
- **AST-Aware Markdown & Code Chunker**: Preserves heading hierarchies (`#`, `##`, `###`) and embeds section tags for contextual grounding.
- **Single & Batch Web URL Scraper**: Ingest individual URLs or batch lists of target pages with automatic timeout guards (`AbortSignal.timeout(4000)`).
- **Inventory Management**: Document table with chunk counts, format identifiers, sample previews, chunk inspection modal, and one-click deletion.
- **Reset Defaults**: Instantly re-index pre-loaded documents (`About_ChatGPT_500_Words.pdf`, `sample1.txt`, `sample2.txt`, `books.jsonl`).

### 3. RAG Inspector & Retrieval Playground
- **Pure Semantic Search Inspector**: Test vector cosine retrieval directly without LLM synthesis to verify indexing quality.
- **Ranked Similarity Visualizer**: Inspect match percentages and ranked chunk payloads.
- **Chunking Sandbox**: Real-time visualizer showing how arbitrary texts are split into distinct overlapping chunks with custom size and overlap sliders.

### 4. System Control & Provider Settings
- **Dual LLM Routing**: Switch between Google Gemini (`gemini-3.8-flash`) and Groq (`llama-3.3-70b-versatile`).
- **Vector Store Selection**: Switch between local in-memory FAISS and cloud Typesense.
- **Diagnostics & Health Probing**: Monitor collection stats, embedding dimension (384-dim), chunk counts, uptime, and index health.
- **Store Maintenance**: Purge and re-initialize vector stores with confirmation safeguards.

---

## Architecture Overview

```text
.
├── frontend/                 # Next.js 16 App Router UI (port 3000)
│   ├── app/
│   │   ├── api/              # Full-stack Node.js API endpoints
│   │   │   ├── chat/         # /api/chat/query & /api/chat/stream (SSE)
│   │   │   ├── documents/    # /api/documents (upload, url, batch-urls, reindex, [id])
│   │   │   ├── sessions/     # /api/sessions & /api/sessions/[id] (Multi-turn threads)
│   │   │   ├── vector-store/ # /api/vector-store (stats, clear)
│   │   │   ├── config/       # /api/config
│   │   │   └── health/       # /api/health
│   │   ├── globals.css       # Tailwind CSS v4 design system
│   │   ├── layout.tsx        # Root HTML layout and metadata
│   │   └── page.tsx          # Workspace dashboard uniting all 4 views
│   ├── components/           # Modular React components
│   │   ├── ChatbotView.tsx   # Utility 1: Streaming RAG Chatbot & Session Switcher
│   │   ├── KnowledgeBaseView.tsx # Utility 2: Knowledge Base & Batch URL Ingestion
│   │   ├── PlaygroundView.tsx# Utility 3: RAG Inspector & Sandbox
│   │   ├── SettingsView.tsx  # Utility 4: System Control & Diagnostics
│   │   ├── Navbar.tsx        # Top Bar Telemetry Contract
│   │   └── Sidebar.tsx       # Navigation Workspace Sidebar
│   └── lib/
│       └── rag-store.ts      # Vector algebra, AST chunking, Cross-Encoder reranker, Gemini SDK
├── api/                      # FastAPI Backend Server (port 8000)
│   ├── main.py               # Lifespan singletons, CORS, server entrypoint
│   ├── routes/               # FastAPI routers (chat, documents, system)
│   ├── schemas.py            # Pydantic request & response models
│   └── services.py           # Python RAGService singleton & async workers
├── src/                      # Python Core RAG Engine
│   ├── chunking.py           # Recursive & Character chunk splitters
│   ├── embeddings.py         # SentenceTransformer (all-MiniLM-L6-v2)
│   ├── llm.py                # Gemini & Groq multi-provider
│   ├── loaders.py            # Local file & web loader interfaces
│   ├── pipeline.py           # Grounded prompting & streaming generator
│   └── vector_store.py       # Typesense and local FAISS vector backends
├── tests/                    # Automated Test Suite (44/44 tests passing)
│   ├── api_suite.test.ts     # 17 REST & SSE API integration tests
│   ├── rag_engine_suite.test.ts # 11 Vector algebra, AST chunking, reranking & session tests
│   └── frontend_e2e_suite.test.ts # 16 Frontend workflow, buttons, navigation & E2E tests
├── package.json              # Root workspace orchestrator
├── development-phases.md     # Phased development roadmap
└── issues.md                 # Issues audit and resolution tracker
```

---

## API Endpoints

The system exposes full REST and SSE streaming endpoints across Next.js and FastAPI:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/chat/stream` | Server-Sent Events (SSE) streaming LLM answer with immediate citation metadata and multi-turn history. |
| `POST` | `/api/chat/query` | Standard Q&A returning answer, sources, confidence, and context with history support. |
| `GET` | `/api/sessions` | List all active conversation sessions and thread metadata. |
| `POST` | `/api/sessions` | Create a new isolated conversation session. |
| `GET` | `/api/sessions/{id}` | Retrieve specific session messages and history. |
| `PUT` | `/api/sessions/{id}` | Update session messages and title. |
| `DELETE` | `/api/sessions/{id}` | Delete a conversation session. |
| `POST` | `/api/documents/upload` | Upload `.pdf`, `.txt`, `.md`, or `.json` file for dynamic ingestion. |
| `POST` | `/api/documents/url` | Ingest and index content from a single public web URL. |
| `POST` | `/api/documents/batch-urls` | Batch ingest multiple web URLs with timeout protection and status metrics. |
| `GET` | `/api/documents` | List all ingested documents with chunk counts and sample snippets. |
| `DELETE` | `/api/documents/{id}` | Delete a document and its indexed chunks. |
| `POST` | `/api/documents/reindex` | Re-index default knowledge base documents. |
| `GET` | `/api/vector-store/stats` | View active collection stats, vector dimensions, and chunk count. |
| `DELETE` | `/api/vector-store/clear` | Purge all indexed vectors. |
| `GET` / `POST` | `/api/config` | View or update active provider, model, and chunk parameters. |
| `GET` | `/api/health` | Health check probe with uptime and store metrics. |

---

## Automated Test Suite

Run the full end-to-end test suite:
```bash
npm test
```

### Test Suite Execution Summary
- **Total Tests**: 44 tests across 13 suites
- **Passed**: 44
- **Failed**: 0
- **Duration**: ~3.5 seconds
- **Suites Included**:
  1. `tests/api_suite.test.ts` (17 tests): Health check, config GET/POST, document upload, single URL, batch URLs, reindexing, document deletion, chat query validation, SSE streaming token pacing, sessions CRUD, store purge.
  2. `tests/rag_engine_suite.test.ts` (11 tests): Chunk size bounding, overlap preservation, edge cases, AST-aware markdown header chunking, vector cosine similarity thresholding, top-k limits, keyword boost, two-stage cross-encoder reranking deltas, document deduplication, multi-session memory.
  3. `tests/frontend_e2e_suite.test.ts` (16 tests): Navigation tab routing and titles, Navbar unboxed telemetry counts, full question-answer cycle with citations, suggested inquiry prompts, session reset, search table filter, document chunk inspection modal, document add/delete, pure semantic search, chunking sandbox sliders, LLM provider switching, vector backend switching, default chunk parameters, multi-session UI context isolation, empty vector store guidance, and batch URL protocol sanitization.

---

## Quickstart

### Running the Next.js Frontend
```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the complete application.

### Running the FastAPI Backend (Optional Python Service)
```bash
# Sync Python dependencies with uv
uv sync

# Run FastAPI server on port 8000
uv run uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive Swagger docs are available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### Environment Configuration
Configure `.env` in the root directory:
```env
# LLM Providers
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
LLM_PROVIDER=gemini
GEMINI_MODEL_NAME=gemini-3.8-flash
GROQ_MODEL_NAME=llama-3.3-70b-versatile

# Vector Store
VECTOR_STORE_BACKEND=faiss
TYPESENSE_HOST=your-typesense-host
TYPESENSE_PORT=8108
TYPESENSE_ADMIN_KEY=your-typesense-admin-key
```

---

## Project Status

- **Phase 1: Core Engine Refactoring & Consolidation**: ✅ **Completed**
- **Phase 2: FastAPI Backend Engine**: ✅ **Completed**
- **Phase 3: Next.js (App Router) Frontend**: ✅ **Completed**
- **Phase 4: SaaS Hardening & Production Polish**: ✅ **Completed**

