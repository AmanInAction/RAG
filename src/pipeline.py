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


def _generate_text(llm: Any, prompt: str) -> str:
    if hasattr(llm, "generate"):
        return llm.generate(prompt)
    response = llm.interactions.create(
        model=GEMINI_MODEL_NAME,
        input=prompt,
    )
    return response.output_text


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
    return _generate_text(llm, _build_prompt(context, query))


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
    answer = _generate_text(llm, _build_prompt(context, query))
    output: Dict[str, Any] = {
        "answer": answer,
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


def rag_stream(
    query: str,
    retriever: RAGRetriever,
    llm: Any,
    top_k: int = 5,
    min_score: float = 0.2,
) -> tuple[Dict[str, Any], Any]:
    """Retrieve context, format metadata, and return (metadata_dict, token_iterator)."""
    results = retriever.retrieval(query, top_k=top_k, score_threshold=min_score)
    if not results:
        metadata = {
            "sources": [],
            "confidence": 0.0,
            "context": "",
            "has_context": False,
        }

        def empty_gen():
            yield NO_CONTEXT_MESSAGE

        return metadata, empty_gen()

    context = "\n\n".join(item["content"] for item in results)
    prompt = _build_prompt(context, query)
    metadata = {
        "sources": [
            {
                "source": item["metadata"].get(
                    "source_file", item["metadata"].get("source", "unknown")
                ),
                "page": item["metadata"].get("page", "unknown"),
                "score": round(item["similarity_score"], 4),
                "preview": item["content"][:220] + "...",
            }
            for item in results
        ],
        "confidence": round(max(item["similarity_score"] for item in results), 4),
        "context": context,
        "has_context": True,
    }

    def token_gen():
        if hasattr(llm, "stream_generate"):
            for token in llm.stream_generate(prompt):
                yield token
        else:
            yield _generate_text(llm, prompt)

    return metadata, token_gen()

