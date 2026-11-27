# Custom RAG evaluation dataset

Create benchmark cases from the documents indexed in your live backend. Do not use the frontend's in-memory demo chunks as ground truth.

## Case schema

```json
{
  "id": "policy-refund-01",
  "query": "What is the refund period?",
  "relevant_chunk_ids": ["<exact chunk id from /api/evaluation/inspect>"],
  "reference_answer": "A concise answer supported by the indexed documents.",
  "reference_contexts": ["Optional exact reference passage."]
}
```

Use `GET /api/evaluation/inspect?query=...` to see the actual backend's retrieved chunk IDs and content. Annotate all chunks that contain evidence needed to answer the question, then save the dataset through `PUT /api/evaluation/dataset` or the Evaluation screen.

A case without relevant chunk IDs can still be used for judge/latency metrics, but Recall@k and MRR are omitted for that case. Do not invent chunk IDs. Build 30–50 diverse questions for a meaningful benchmark, including answerable, multi-hop, ambiguous, and unanswerable questions.

## Metrics and caveats

- Recall@k and MRR are deterministic and require relevant chunk IDs.
- Faithfulness, answer relevance, and context relevance are LLM-judge metrics.
- Context precision is the mean judge relevance across retrieved chunks.
- Latencies are wall-clock measurements for retrieval, generation, and judge.
- Token counts are estimates based on characters divided by four because the current provider abstraction does not expose a consistent usage contract.
- API cost is only estimated when model-specific input/output rates are configured with `RAG_EVAL_INPUT_COST_PER_1K` and `RAG_EVAL_OUTPUT_COST_PER_1K`. Otherwise it is explicitly unavailable.
- Ingestion latency is not included in a query benchmark. Measure a controlled re-index separately before reporting ingestion performance.
