# Local Retrieval-Augmented Generation

This project is a small, modular RAG application. It loads local documents or web pages, creates vector embeddings, retrieves relevant chunks, and generates answers grounded in retrieved context. Ingestion formats and the embedding model, chunking strategy, vector store, and LLM provider can be configured.

The code began as an exploratory notebook and is now organized as reusable Python modules. The current entry point is `main.py`.

## Current Workflow

1. Read `.txt`, Markdown, JSON, and PDF documents from `data/text_files/`; optionally fetch URLs listed in `data/web_urls.txt`.
2. Split documents into overlapping chunks with the configured recursive or character splitter.
3. Generate embeddings locally with the configured Sentence Transformers model (default: `all-MiniLM-L6-v2`).
4. Store chunks and embeddings in the configured Typesense or local FAISS vector store.
5. Retrieve the highest-scoring chunks for a query.
6. Send the retrieved context to the configured Gemini or Groq model with instructions to avoid unsupported answers.

The default command runs one example question from `main.py` and prints the answer, source metadata, and confidence score. Typesense collections are created automatically when needed. Both vector stores use deterministic document IDs to avoid duplicating identical chunks on repeated ingestion.

## Project Structure

```text
.
├── data/
│   └── text_files/       # Local source documents
├── data/web_urls.txt     # Optional web pages, one URL per line
├── main.py               # Application entry point and pipeline wiring
├── src/
│   ├── chunking.py       # Configurable document splitting
│   ├── config.py         # Paths and provider defaults
│   ├── embeddings.py     # Configurable Sentence Transformers embeddings
│   ├── loaders.py        # Common local-file and web-page loader interface
│   ├── llm.py            # Gemini and Groq provider selection
│   ├── pipeline.py       # Prompting and RAG functions
│   ├── retriever.py      # Similarity search and score filtering
│   └── vector_store.py   # Typesense and FAISS backends
├── requirements.txt      # Pip dependency list
└── pyproject.toml        # Project metadata and dependency configuration
```

## Setup

The project requires Python 3.13 or newer.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create a local `.env` file in the project root. The defaults below use Typesense, Gemini, recursive chunking, and the local MiniLM embedding model:

```text
GEMINI_API_KEY=your-api-key
TYPESENSE_HOST=your-typesense-host
TYPESENSE_PORT=443
TYPESENSE_ADMIN_KEY=your-typesense-admin-key
VECTOR_STORE_BACKEND=typesense
TYPESENSE_COLLECTION_NAME=document_embeddings
LLM_PROVIDER=gemini
GEMINI_MODEL_NAME=gemini-3.1-flash-lite
EMBEDDING_MODEL_NAME=all-MiniLM-L6-v2
CHUNKING_STRATEGY=recursive
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
# Optional when using LLM_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
```

Typesense settings are needed only when `VECTOR_STORE_BACKEND=typesense`; the host should not include a protocol prefix, and the application connects over HTTPS. Do not commit `.env` or API keys to source control. The first run may download the embedding model, which can take a few minutes.

For a local vector index, set `VECTOR_STORE_BACKEND=faiss`. It is saved under `data/faiss_store/` by default (override with `FAISS_DIRECTORY`). For Groq, set `LLM_PROVIDER=groq`, provide `GROQ_API_KEY`, and optionally set `GROQ_MODEL_NAME` (default: `llama-3.3-70b-versatile`). To change the embedding model, set `EMBEDDING_MODEL_NAME` to a Sentence Transformers model ID. Use a new `TYPESENSE_COLLECTION_NAME` or `FAISS_DIRECTORY` when switching embedding models; Typesense filters documents by model and FAISS rejects a directory saved for a different model.

Place `.txt`, `.md`, `.markdown`, `.json`, and `.pdf` files in `data/text_files/`. JSON documents are serialized as readable, indented JSON before chunking. To ingest static web pages, create `data/web_urls.txt` with one `http://` or `https://` URL per line; blank lines and lines beginning with `#` are ignored. Web content is fetched at runtime and requires network access.

## Run

Run the application from the project root:

```powershell
python main.py
```

Add or replace supported files in `data/text_files/` or URLs in `data/web_urls.txt` before running. The example query is in `main.py`; provider and chunking settings can be set in `.env`.

Run the automated tests with:

```powershell
python -m unittest discover -s tests
```

## Module Usage

The components can be used independently for debugging or experiments:

```python
from src.chunking import split_documents
from src.config import TEXTS_DIRECTORY, WEB_URLS_FILE
from src.embeddings import EmbeddingManager
from src.loaders import load_documents
from src.llm import LLMProvider
from src.retriever import RAGRetriever
from src.vector_store import VectorStore

documents = load_documents(TEXTS_DIRECTORY, WEB_URLS_FILE)
chunks = split_documents(documents)
embedding_manager = EmbeddingManager()
store = VectorStore(
    embedding_manager.embedding_dimension,
    embedding_model_name=embedding_manager.model_name,
)
store.add_documents(chunks, embedding_manager.generate_embeddings(chunks))
retriever = RAGRetriever(store, embedding_manager)
results = retriever.retrieval("Ask a question about the documents")
llm = LLMProvider()
```

For a complete flow, use `simple_rag` or `rag_advanced` from `src.pipeline` with the configured LLM provider.

## Current Limitations

- The example query is hard-coded in `main.py`.
- Ingestion and embedding run every time the application starts.
- Changed or removed source documents are not automatically pruned from a vector store; use a clean index when source documents change substantially.
- Web ingestion handles static HTML pages, not JavaScript-rendered pages or authenticated sites.
- There is no web interface, authentication, or retrieval evaluation dataset yet.

## Future Scope

### Near Term

- Accept questions and ingestion options from a CLI instead of hard-coding them.
- Add an explicit re-index command that can prune chunks from changed or removed source documents.
- Expand unit tests to cover retrieval thresholds and prompt construction.
- Improve structured logging and error messages for missing files, models, and API configuration.

### Product Features

- Add conversation history, streaming responses, citations, and source previews.
- Build a lightweight web UI for document management and question answering.

### Reliability And Scale

- Add retrieval evaluation with a labeled question-and-answer dataset.
- Measure answer faithfulness, context relevance, latency, and token cost.
- Add metadata filters, hybrid keyword-plus-vector search, reranking, and configurable caching.
- Define backup, retention, and secret-management requirements for hosted Typesense and Gemini credentials.
