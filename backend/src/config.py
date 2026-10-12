from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TEXTS_DIRECTORY = PROJECT_ROOT / "data" / "text_files"
WEB_URLS_FILE = PROJECT_ROOT / "data" / "web_urls.txt"
FAISS_DIRECTORY = PROJECT_ROOT / "data" / "faiss_store"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
COLLECTION_NAME = "document_embeddings"
GEMINI_MODEL_NAME = "gemini-3.1-flash-lite"
GROQ_MODEL_NAME = "llama-3.3-70b-versatile"
DEFAULT_CHUNK_SIZE = 1000
DEFAULT_CHUNK_OVERLAP = 200
