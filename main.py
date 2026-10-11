"""Run the configurable document-ingestion and RAG pipeline."""

from dotenv import load_dotenv

from src.chunking import split_documents
from src.config import TEXTS_DIRECTORY, WEB_URLS_FILE
from src.embeddings import EmbeddingManager
from src.llm import LLMProvider
from src.loaders import load_documents
from src.pipeline import rag_advanced
from src.retriever import RAGRetriever
from src.vector_store import VectorStore


def build_pipeline() -> RAGRetriever:
    documents = load_documents(TEXTS_DIRECTORY, WEB_URLS_FILE)
    chunks = split_documents(documents)
    embedding_manager = EmbeddingManager()
    vector_store = VectorStore(
        embedding_manager.embedding_dimension,
        embedding_model_name=embedding_manager.model_name,
    )
    embeddings = embedding_manager.generate_embeddings(chunks)
    vector_store.add_documents(chunks, embeddings)
    return RAGRetriever(vector_store, embedding_manager)


def main() -> None:
    load_dotenv()
    client = LLMProvider()
    retriever = build_pipeline()
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
