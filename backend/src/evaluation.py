"""Ground-truth RAG evaluation for the live FastAPI retrieval/generation pipeline."""
from __future__ import annotations
import json, os, re, statistics, time
from pathlib import Path
from typing import Any, Dict, List, Optional
from .pipeline import FALLBACK_ANSWER, _build_prompt, _generate_text

PROJECT_ROOT = Path(__file__).resolve().parent.parent
EVALUATION_DIR = PROJECT_ROOT / "data" / "evaluation"
DATASET_PATH = EVALUATION_DIR / "benchmark.json"
REPORT_PATH = EVALUATION_DIR / "latest_report.json"


def load_dataset() -> Dict[str, Any]:
    if not DATASET_PATH.exists():
        return {"name": "Custom RAG benchmark", "version": 1, "cases": []}
    return json.loads(DATASET_PATH.read_text(encoding="utf-8"))


def save_dataset(payload: Dict[str, Any]) -> Dict[str, Any]:
    cases = payload.get("cases")
    if not isinstance(cases, list):
        raise ValueError("'cases' must be an array.")
    if len(cases) > 200:
        raise ValueError("A benchmark may contain at most 200 cases.")
    seen, normalized_cases = set(), []
    for index, original in enumerate(cases):
        if not isinstance(original, dict):
            raise ValueError(f"Case {index + 1} must be an object.")
        case = dict(original)
        query, ids = case.get("query"), case.get("relevant_chunk_ids", [])
        if not isinstance(query, str) or not query.strip():
            raise ValueError(f"Case {index + 1} needs a non-empty query.")
        if not isinstance(ids, list) or not all(isinstance(x, str) and x.strip() for x in ids):
            raise ValueError(f"Case {index + 1} relevant_chunk_ids must be an array of chunk ID strings.")
        if any("paste-an-exact-chunk-id" in x for x in ids):
            raise ValueError(f"Case {index + 1} still contains the example placeholder chunk ID.")
        case_id = str(case.get("id") or f"case-{index + 1}")
        if case_id in seen:
            raise ValueError(f"Duplicate case id: {case_id}")
        seen.add(case_id)
        refs = case.get("reference_contexts", [])
        if not isinstance(refs, list) or not all(isinstance(x, str) for x in refs):
            raise ValueError(f"Case {case_id} reference_contexts must be an array of strings.")
        case.update({"id": case_id, "query": query.strip(), "relevant_chunk_ids": ids,
                     "reference_answer": str(case.get("reference_answer") or ""),
                     "reference_contexts": refs})
        normalized_cases.append(case)
    normalized = {"name": str(payload.get("name") or "Custom RAG benchmark"),
                  "version": 1, "cases": normalized_cases}
    EVALUATION_DIR.mkdir(parents=True, exist_ok=True)
    DATASET_PATH.write_text(json.dumps(normalized, indent=2, ensure_ascii=False), encoding="utf-8")
    return normalized


def average_precision_at_k(retrieved_ids: List[str], relevant_ids: set[str]) -> Optional[float]:
    if not relevant_ids:
        return None
    hits, total = 0, 0.0
    for rank, chunk_id in enumerate(retrieved_ids, start=1):
        if chunk_id in relevant_ids:
            hits += 1
            total += hits / rank
    return round(total / min(len(relevant_ids), len(retrieved_ids) or 1), 4)


def _parse_judge_json(raw: str) -> Optional[Dict[str, Any]]:
    match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
    if not match:
        return None
    try:
        value = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def _number(value: Any) -> Optional[float]:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return None


def _judge_case(llm: Any, query: str, answer: str, context: str,
                reference_answer: str, reference_contexts: List[str]) -> Dict[str, Any]:
    prompt = f"""You are a strict evaluator of a retrieval-augmented generation system.
Return JSON only:
- faithfulness: number 0..1, fraction of factual answer claims supported by CONTEXT
- answer_relevance: number 0..1, how directly the answer addresses QUESTION
- context_relevance: array of numbers 0..1, one per retrieved passage, in passage order
Do not reward unsupported claims. A refusal is faithful only if the context genuinely lacks the answer.
Reference answer is a guide, not a requirement for identical wording.
QUESTION: {query}
REFERENCE ANSWER: {reference_answer or "(not supplied)"}
REFERENCE PASSAGES: {json.dumps(reference_contexts, ensure_ascii=False)}
RETRIEVED PASSAGES (rank order): {context}
GENERATED ANSWER: {answer}
JSON:"""
    parsed = _parse_judge_json(_generate_text(llm, prompt))
    if parsed is None:
        return {"faithfulness": None, "answer_relevance": None,
                "context_relevance": [], "judge_status": "invalid_json"}
    values = parsed.get("context_relevance", [])
    if not isinstance(values, list):
        values = []
    return {"faithfulness": _number(parsed.get("faithfulness")),
            "answer_relevance": _number(parsed.get("answer_relevance")),
            "context_relevance": [n for n in (_number(x) for x in values) if n is not None],
            "judge_status": "ok"}


def _mean(values: List[Optional[float]]) -> Optional[float]:
    valid = [v for v in values if v is not None]
    return round(statistics.mean(valid), 4) if valid else None


def run_evaluation(retriever: Any, llm: Any, provider: str, top_k: int = 5,
                   min_score: float = 0.0) -> Dict[str, Any]:
    dataset = load_dataset()
    cases = dataset.get("cases", [])
    if not cases:
        raise ValueError("The custom benchmark is empty. Add test cases before running evaluation.")
    rows, faiths, answers, aps, contexts, recalls, mrrs = [], [], [], [], [], [], []
    retrieval_ms, generation_ms, judge_ms = [], [], []
    estimated_input_tokens = estimated_output_tokens = 0

    for case in cases:
        query = case["query"]
        expected = set(case.get("relevant_chunk_ids", []))
        start = time.perf_counter()
        results = retriever.retrieval(query, top_k=top_k, score_threshold=min_score)
        rt = (time.perf_counter() - start) * 1000
        retrieval_ms.append(rt)
        ids = [str(item["id"]) for item in results]
        context = "\n\n".join(item["content"] for item in results)
        prompt = _build_prompt(context, query) if results else ""
        start = time.perf_counter()
        answer = _generate_text(llm, prompt) if results else FALLBACK_ANSWER
        gt = (time.perf_counter() - start) * 1000
        generation_ms.append(gt)

        recall = len(expected.intersection(ids)) / len(expected) if expected else None
        first_rank = next((i + 1 for i, chunk_id in enumerate(ids) if chunk_id in expected), None) if expected else None
        mrr = (1 / first_rank) if first_rank else (0.0 if expected else None)
        ap = average_precision_at_k(ids, expected)
        recalls.append(recall); mrrs.append(mrr); aps.append(ap)

        start = time.perf_counter()
        judged = _judge_case(llm, query, answer, context,
                             str(case.get("reference_answer") or ""),
                             case.get("reference_contexts") or [])
        jt = (time.perf_counter() - start) * 1000
        judge_ms.append(jt)
        faiths.append(judged["faithfulness"]); answers.append(judged["answer_relevance"])
        relevance = judged["context_relevance"]
        contexts.append(_mean(relevance) if relevance else None)
        # Estimate only. Judge-call token usage is excluded.
        estimated_input_tokens += max(1, len(prompt) // 4) if prompt else max(1, len(query) // 4)
        estimated_output_tokens += max(1, len(answer) // 4)
        rows.append({
            "id": case["id"], "query": query,
            "retrieved": [{"chunk_id": str(item["id"]), "rank": item["rank"],
                           "similarity_score": round(float(item["similarity_score"]), 4),
                           "source": (item.get("metadata") or {}).get("source_file",
                                     (item.get("metadata") or {}).get("source", "unknown")),
                           "preview": item["content"][:280]} for item in results],
            "relevant_chunk_ids": sorted(expected),
            "recall_at_k": round(recall, 4) if recall is not None else None,
            "mrr": round(mrr, 4) if mrr is not None else None, "context_precision": ap,
            "faithfulness": judged["faithfulness"], "answer_relevance": judged["answer_relevance"],
            "context_relevance": _mean(relevance) if relevance else None,
            "judge_status": judged["judge_status"], "answer": answer,
            "latency_ms": {"retrieval": round(rt, 2), "generation": round(gt, 2),
                           "judge": round(jt, 2), "total": round(rt + gt + jt, 2)}})

    input_rate, output_rate = os.getenv("RAG_EVAL_INPUT_COST_PER_1K"), os.getenv("RAG_EVAL_OUTPUT_COST_PER_1K")
    estimated_cost = None
    if input_rate is not None and output_rate is not None:
        try:
            estimated_cost = round(estimated_input_tokens / 1000 * float(input_rate)
                                   + estimated_output_tokens / 1000 * float(output_rate), 8)
        except ValueError:
            pass
    report = {
        "dataset_name": dataset.get("name", "Custom RAG benchmark"), "dataset_cases": len(cases),
        "provider": provider, "top_k": top_k, "min_score": min_score,
        "metrics": {
            "recall_at_k": _mean(recalls), "mrr": _mean(mrrs), "faithfulness": _mean(faiths),
            "answer_relevance": _mean(answers), "context_precision": _mean(aps),
            "context_relevance": _mean(contexts),
            "latency_ms": {"retrieval_avg": round(statistics.mean(retrieval_ms), 2),
                           "generation_avg": round(statistics.mean(generation_ms), 2),
                           "judge_avg": round(statistics.mean(judge_ms), 2),
                           "total_avg": round(statistics.mean([r["latency_ms"]["total"] for r in rows]), 2)},
            "token_usage": {"input_tokens_estimated": estimated_input_tokens,
                            "output_tokens_estimated": estimated_output_tokens,
                            "method": "character_count_divided_by_4; estimate, not provider-reported usage; excludes judge calls"},
            "api_cost": {"estimated_cost": estimated_cost,
                         "currency": os.getenv("RAG_EVAL_COST_CURRENCY", "USD"),
                         "status": "estimated_from_configured_rates" if estimated_cost is not None else "not_configured",
                         "note": "Set model-specific RAG_EVAL_INPUT_COST_PER_1K and RAG_EVAL_OUTPUT_COST_PER_1K. Estimate excludes judge calls."}},
        "scoring_notes": {
            "retrieval_metrics": "Recall@k, MRR and context precision use exact relevant_chunk_ids annotations.",
            "judge_metrics": "Faithfulness, answer relevance and context relevance are LLM-judge scores.",
            "context_precision": "Average precision over the ranked retrieved chunks using annotated relevant chunk IDs.",
            "latency": "Wall-clock retrieval, generation and judge latency are measured separately.",
            "ingestion_latency": "Not included in a query benchmark; measure a controlled re-index run separately."},
        "cases": rows, "created_at": time.time()}
    EVALUATION_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report
