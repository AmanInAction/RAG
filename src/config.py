from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TEXTS_DIRECTORY = PROJECT_ROOT / "data" / "text_files"
VECTOR_STORE_DIRECTORY = PROJECT_ROOT / "data" / "vector_store"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
COLLECTION_NAME = "document_embeddings"
GEMINI_MODEL_NAME = "gemini-3.1-flash-lite"
