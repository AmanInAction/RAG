# Local Retrieval-Augmented Generation

This project is a small, modular RAG application. It turns local text documents into searchable vector representations, retrieves the chunks most relevant to a question, and uses Google Gemini to generate an answer grounded in that retrieved context.

The code began as an exploratory notebook and is now organized as reusable Python modules. The current entry point is `main.py`.

## Current Workflow

1. Read UTF-8 `.txt` files from `data/text_files/`.
2. Split documents into overlapping chunks with LangChain's recursive text splitter.
3. Generate embeddings with the `all-MiniLM-L6-v2` sentence-transformer model.
4. Store chunks and embeddings in a persistent Chroma collection under `data/vector_store/`.
5. Retrieve the highest-scoring chunks for a query.
6. Send the retrieved context to Gemini with instructions to avoid unsupported answers.

The default command runs one example question from `main.py` and prints the answer, source metadata, and confidence score.

## Project Structure

```text
.
├── data/
│   ├── text_files/       # Local source documents
│   └── vector_store/     # Persistent Chroma data
├── main.py               # Application entry point and pipeline wiring
├── src/
│   ├── chunking.py       # Document splitting
│   ├── config.py         # Paths and model configuration
│   ├── embeddings.py     # Sentence-transformer embeddings
│   ├── loaders.py        # Text and PDF loading helpers
│   ├── pipeline.py       # Prompting and Gemini RAG functions
│   ├── retriever.py      # Similarity search and score filtering
│   └── vector_store.py   # Chroma persistence and document writes
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

Create a local `.env` file in the project root and add a Gemini API key:

```text
GEMINI_API_KEY=your-api-key
```

Do not commit `.env` or API keys to source control. The first run may download the embedding model, which can take a few minutes.

## Run

Run the application from the project root:

```powershell
python main.py
```

Add or replace `.txt` files in `data/text_files/` before running. The default query and model settings are defined in `main.py` and `src/config.py`.

## Module Usage

The components can be used independently for debugging or experiments:

```python
from src.chunking import split_documents
from src.config import TEXTS_DIRECTORY
from src.embeddings import EmbeddingManager
from src.loaders import load_text_directory
from src.retriever import RAGRetriever
from src.vector_store import VectorStore

documents = load_text_directory(TEXTS_DIRECTORY)
chunks = split_documents(documents)
embedding_manager = EmbeddingManager()
store = VectorStore()
store.add_documents(chunks, embedding_manager.generate_embeddings(chunks))
retriever = RAGRetriever(store, embedding_manager)
results = retriever.retrieval("Ask a question about the documents")
```

For a complete flow, use `simple_rag` or `rag_advanced` from `src.pipeline` with a configured Gemini client.

## Current Limitations

- The example query is hard-coded in `main.py`.
- Ingestion and embedding run every time the application starts.
- New vector IDs are generated on every ingestion, so repeated runs can duplicate chunks.
- The application currently supports local text ingestion in the default workflow; PDF loading is available as a helper but is not wired into `main.py`.
- There is no web interface, authentication, automated test suite, or evaluation dataset yet.

## Future Scope

### Near Term

- Accept questions and ingestion options from a CLI instead of hard-coding them.
- Add deterministic document IDs, deduplication, and an explicit re-index command.
- Add unit tests for loading, chunking, retrieval thresholds, and prompt construction.
- Improve structured logging and error messages for missing files, models, and API configuration.

### Product Features

- Support PDF, Markdown, JSON, and web-page ingestion through a common loader interface.
- Add conversation history, streaming responses, citations, and source previews.
- Build a lightweight web UI for document management and question answering.
- Add configurable embedding models, chunking strategies, vector databases, and LLM providers.

### Reliability And Scale

- Add retrieval evaluation with a labeled question-and-answer dataset.
- Measure answer faithfulness, context relevance, latency, and token cost.
- Add metadata filters, hybrid keyword-plus-vector search, reranking, and configurable caching.
- Move persistent storage and secrets to production-ready managed services when deployment requirements are defined.
