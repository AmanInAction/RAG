from typing import Any, Dict

from .config import GEMINI_MODEL_NAME
from .retriever import RAGRetriever


NO_CONTEXT_MESSAGE = "No relevant context found"
FALLBACK_ANSWER = "I couldn't find that information in the provided documents."


def _build_prompt(context: str, query: str) -> str:
    return f"""You are a helpful assistant.

Use ONLY the provided context to answer the question.
If the answer is not present in the context, say:
\"{FALLBACK_ANSWER}\"

Context:
{context}

Question:
{query}

Answer:
"""


def simple_rag(query: str, retriever: RAGRetriever, llm: Any, top_k: int = 3) -> str | None:
    """Retrieve context and return an LLM answer."""
    results = retriever.retrieval(query, top_k=top_k)
    if not results:
        print("No relevant documents found.")
        return None
    context = "\n\n".join(
        f"Document {item['rank']} (Score: {item['similarity_score']:.4f}):\n{item['content']}"
        for item in results
    )
    response = llm.interactions.create(
        model=GEMINI_MODEL_NAME,
        input=_build_prompt(context, query),
    )
    return response.output_text


def rag_advanced(
    query: str,
    retriever: RAGRetriever,
    llm: Any,
    top_k: int = 5,
    min_score: float = 0.2,
    return_context: bool = False,
) -> Dict[str, Any]:
    """Return an answer together with sources, confidence, and optional context."""
    results = retriever.retrieval(query, top_k=top_k, score_threshold=min_score)
    if not results:
        return {"answer": NO_CONTEXT_MESSAGE, "sources": [], "confidence": 0.0, "context": ""}

    context = "\n\n".join(item["content"] for item in results)
    response = llm.interactions.create(
        model=GEMINI_MODEL_NAME,
        input=_build_prompt(context, query),
    )
    output: Dict[str, Any] = {
        "answer": response.output_text,
        "sources": [
            {
                "source": item["metadata"].get("source_file", item["metadata"].get("source", "unknown")),
                "page": item["metadata"].get("page", "unknown"),
                "score": item["similarity_score"],
                "preview": item["content"][:220] + "...",
            }
            for item in results
        ],
        "confidence": max(item["similarity_score"] for item in results),
    }
    if return_context:
        output["context"] = context
    return output
