"""Run the notebook's document-ingestion and RAG pipeline."""

import os

from dotenv import load_dotenv
from google import genai

from src.chunking import split_documents
from src.config import TEXTS_DIRECTORY
from src.embeddings import EmbeddingManager
from src.loaders import load_text_directory
from src.pipeline import rag_advanced
from src.retriever import RAGRetriever
from src.vector_store import VectorStore


def build_pipeline() -> RAGRetriever:
    documents = load_text_directory(TEXTS_DIRECTORY)
    chunks = split_documents(documents)
    embedding_manager = EmbeddingManager()
    vector_store = VectorStore()
    embeddings = embedding_manager.generate_embeddings(chunks)
    vector_store.add_documents(chunks, embeddings)
    return RAGRetriever(vector_store, embedding_manager)


def main() -> None:
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set.")

    retriever = build_pipeline()
    client = genai.Client(api_key=api_key)
    result = rag_advanced(
        "What is the purpose of ChatGPT?",
        retriever,
        client,
        top_k=3,
        min_score=0.2,
        return_context=True,
    )
    print("Answer:", result["answer"])
    print("Sources:", result["sources"])
    print("Confidence:", result["confidence"])


if __name__ == "__main__":
    main()
