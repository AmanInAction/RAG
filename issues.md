# Issues in this project

This project works in its configured virtual environment, but there are several project-level issues and risks that affect onboarding, reliability, and maintainability.

## 1) Python version mismatch and onboarding friction

- The project declares `requires-python = ">=3.13"` in `pyproject.toml`, but the default shell environment here is using Python 3.11.
- A plain `python -m unittest discover -s tests` fails with `ModuleNotFoundError: No module named 'numpy'` because the project dependencies are not installed in the system interpreter.
- This means contributors must actively use the project venv (`.venv`) or a matching Python 3.13 environment; otherwise the project appears broken.
- Evidence: `pyproject.toml`, `.python-version`, and the failed test run outside the venv.

## 2) Duplicate dependency management creates inconsistent environments

- The repository has both `pyproject.toml` and `requirements.txt` listing dependencies, which can drift out of sync.
- If a developer installs from one file and not the other, package versions and transitive dependencies can differ.
- This increases onboarding and CI drift risk.
- Evidence: both `pyproject.toml` and `requirements.txt` exist in the project root.

## 3) The app is effectively a hard-coded demo, not a usable end-user application

- `main.py` runs a fixed example question (`"What is the purpose of ChatGPT?"`) instead of accepting user input.
- There is no CLI for choosing a query, ingestion directory, or vector backend at runtime.
- This limits real-world usage and makes the project feel like a prototype rather than a finished product.
- Evidence: `main.py` and the README’s “Current Limitations” section.

## 4) Ingestion and embedding run on every startup

- The pipeline rebuilds the index from source documents every time the app starts.
- This is slow and wasteful for larger document sets and can become brittle when source files change.
- It also increases startup time and makes local iteration slower.
- Evidence: `main.py` and the README’s “Current Limitations”.

## 5) No re-index or document-pruning workflow when sources change

- Changed or removed source documents are not automatically removed from the vector store.
- This can cause stale data to remain searchable even after documents are deleted or edited.
- This is a common RAG issue that affects trust in retrieved answers.
- Evidence: README “Current Limitations”.

## 6) Web ingestion is limited to static pages and misses real-world web content

- `WebPageLoader` is documented as supporting static HTML pages, but not JavaScript-rendered or authenticated sites.
- This means it will fail or underperform for web content that requires browser execution or login.
- Evidence: `src/loaders.py` and README “Current Limitations”.

## 7) The project relies on large ML libraries and external services, which increases operational complexity

- Heavy dependencies such as `sentence-transformers`, `faiss-cpu`, `langchain`, and large model downloads are required for even basic use.
- The app also requires external API keys for Gemini/Groq and optional Typesense configuration.
- That increases setup cost, failure modes, and deployment complexity.
- Evidence: `pyproject.toml`, `src/config.py`, and `src/llm.py`.

## 8) Tests are lightweight and do not cover real runtime behavior or integration failures

- The current tests mostly cover configuration and mock behavior, not end-to-end RAG execution against real documents and vector-store behavior.
- There are no tests for prompt construction, retrieval thresholds, missing env vars, live API failures, or end-to-end answer quality.
- This leaves reliability issues undetected.
- Evidence: the tests under `tests/` and the README’s “Future Scope” section.

## 9) Lack of operational safeguards around missing or invalid configuration

- Missing API keys and misconfigured vector store settings raise runtime errors but there is no structured validation or user-friendly setup wizard.
- This can lead to confusing failures during normal use.
- Evidence: `src/llm.py`, `src/vector_store.py`, and the config-driven setup in the README.

## 10) Project is a prototype, not yet a production-ready RAG system

- The README explicitly lists the project’s current limitations and future scope, including missing CLI, reindexing, logging, retrieval evaluation, citations, and UI features.
- The code is modular and promising, but it is still in an early-stage experimentation state.
- Evidence: README “Current Limitations” and “Future Scope”.

## Validation note

- The project’s unit tests pass inside the repo’s virtual environment:
  - Command: `./.venv/Scripts/python.exe -m unittest discover -s tests`
  - Result: `OK` (10 tests)
- The system Python outside the venv fails because the environment is not configured, which is itself an issue for reproducibility and onboarding.
