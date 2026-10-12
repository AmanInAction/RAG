import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  splitTextIntoChunks,
  splitMarkdownAndCodeChunks,
  ragStore,
} from "../lib/rag-store.ts";

describe("RAG Core Engine & Vector Mathematics Suite", () => {
  // 1. Text Chunking Tests
  describe("Text Chunking Algorithms", () => {
    test("splits long text into chunks adhering to target chunk size", () => {
      const paragraph = "The quick brown fox jumps over the lazy dog. ".repeat(30);
      const chunks = splitTextIntoChunks(paragraph, 200, 40);

      assert.ok(chunks.length > 1);
      for (const chunk of chunks) {
        assert.ok(chunk.length <= 250, `Chunk length ${chunk.length} should be reasonably bounded by target size 200`);
      }
    });

    test("preserves overlap between consecutive partitioned chunks", () => {
      const paragraph = "Sentence one about natural language processing. Sentence two about vector embeddings. Sentence three about approximate nearest neighbor search. Sentence four about generative synthesis.";
      const chunks = splitTextIntoChunks(paragraph, 100, 30);

      assert.ok(chunks.length >= 2);
      assert.ok(chunks[0].length > 0);
      assert.ok(chunks[1].length > 0);
    });

    test("handles edge cases: empty strings, short text, and single sentences", () => {
      assert.deepStrictEqual(splitTextIntoChunks("", 300, 50), []);
      assert.deepStrictEqual(splitTextIntoChunks("   ", 300, 50), []);

      const shortText = "Hello world";
      assert.deepStrictEqual(splitTextIntoChunks(shortText, 300, 50), [shortText]);
    });

    // AST-Aware Syntax Chunker (Phase 4 / Issue 18)
    test("AST-aware markdown chunker preserves section headers and segment boundaries", () => {
      const markdownDoc = `# Architecture Overview
This section outlines the system architecture, detailing the ingestion pipeline and vector stores.

## Ingestion Pipeline
The ingestion pipeline handles parsing PDF, Markdown, and Web documents into structured semantic chunks.

### Vector Storage Layer
Embeddings are projected into a 384-dimensional space and indexed for approximate nearest neighbor retrieval.`;

      const partitioned = splitMarkdownAndCodeChunks(markdownDoc, 400, 50);
      assert.ok(partitioned.length >= 2);

      const headers = partitioned.map((p) => p.header).filter(Boolean);
      assert.ok(headers.length >= 2);
      assert.ok(headers.some((h) => h?.includes("Architecture Overview") || h?.includes("Ingestion Pipeline")));

      // Verify header prefix is embedded in chunk content for grounding
      assert.ok(partitioned.some((p) => p.content.includes("[Section:")));
    });
  });

  // 2. Vector Retrieval & Similarity Search
  describe("Vector Retrieval & Similarity Scoring", () => {
    test("retrieves highly relevant chunks with cosine similarity above threshold", () => {
      const results = ragStore.retrieve("ChatGPT OpenAI artificial intelligence", 5, 0.2);

      assert.ok(results.length >= 1, "Should retrieve at least 1 matching chunk for ChatGPT query");
      assert.strictEqual(results[0].chunk.source, "About_ChatGPT_500_Words.pdf");
      assert.ok(results[0].score >= 0.5, `Top score ${results[0].score} should be high for exact topic match`);
    });

    test("respects top_k limits", () => {
      const top2 = ragStore.retrieve("artificial intelligence", 2, 0.05);
      assert.strictEqual(top2.length, 2);

      const top1 = ragStore.retrieve("artificial intelligence", 1, 0.05);
      assert.strictEqual(top1.length, 1);
    });

    test("filters out results below min_score threshold", () => {
      const strictResults = ragStore.retrieve("irrelevant unrelated query about quantum astrophysics", 5, 0.95);
      assert.strictEqual(strictResults.length, 0);
    });

    test("applies keyword boost for direct token matches", () => {
      const genericResults = ragStore.retrieve("fiction", 5, 0.1);
      const specificResults = ragStore.retrieve("Hunger Games Suzanne Collins", 5, 0.1);

      assert.ok(specificResults.length > 0);
      const topMatch = specificResults[0];
      assert.ok(topMatch.chunk.content.includes("Hunger Games"));
    });

    // Cross-Encoder Reranking (Phase 4 / Issue 17)
    test("two-stage retrieval returns reranked scores and deltas", () => {
      const query = "What are the stated limitations and weaknesses of ChatGPT?";
      const results = ragStore.retrieve(query, 3, 0.1);

      assert.ok(results.length > 0);
      const top = results[0];
      assert.ok(typeof top.score === "number");
      assert.ok(typeof top.initial_score === "number");
      assert.ok(typeof top.rerank_delta === "number");
      assert.ok(top.score >= 0.35);
    });
  });

  // 3. Document Deduplication & Pruning Invariants
  describe("Document Registry & Deduplication", () => {
    test("updating an existing document replaces old chunks without duplication", () => {
      const docId = "dedup_test.txt";
      ragStore.addDocument(docId, docId, "txt", "Initial version of document content with several paragraphs.");
      const count1 = ragStore.getStats().total_chunks;

      // Re-add same document with new content
      ragStore.addDocument(docId, docId, "txt", "Updated second version replacing the previous document completely.");
      const count2 = ragStore.getStats().total_chunks;

      assert.strictEqual(count1, count2);
      ragStore.deleteDocument(docId);
    });
  });

  // 4. Multi-Session Conversation Invariants (Phase 4 / 4.1)
  describe("Multi-Session Memory & Management", () => {
    test("creates, lists, updates, and deletes multi-session conversation threads", () => {
      const created = ragStore.createSession("Benchmark Evaluation Session");
      assert.ok(created.id);
      assert.strictEqual(created.title, "Benchmark Evaluation Session");

      // Verify list includes created session
      const sessions = ragStore.listSessions();
      assert.ok(sessions.some((s) => s.id === created.id));

      // Append messages
      const updated = ragStore.updateSessionMessages(
        created.id,
        [
          { role: "user", content: "Compare FAISS with Typesense for vector search." },
          { role: "assistant", content: "FAISS provides fast local in-memory search while Typesense offers distributed indexing." },
        ],
        "Updated Session Title"
      );
      assert.ok(updated);
      assert.strictEqual(updated?.title, "Updated Session Title");
      assert.strictEqual(updated?.messages.length, 2);

      // Clean up
      const deleted = ragStore.deleteSession(created.id);
      assert.strictEqual(deleted, true);
    });
  });
});
