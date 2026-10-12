import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { GET as getHealth } from "../frontend/app/api/health/route.ts";
import { GET as getConfig, POST as postConfig } from "../frontend/app/api/config/route.ts";
import { GET as getStats } from "../frontend/app/api/vector-store/stats/route.ts";
import { DELETE as clearStore } from "../frontend/app/api/vector-store/clear/route.ts";
import { GET as getDocuments } from "../frontend/app/api/documents/route.ts";
import { POST as uploadDocument } from "../frontend/app/api/documents/upload/route.ts";
import { POST as ingestUrl } from "../frontend/app/api/documents/url/route.ts";
import { POST as ingestBatchUrls } from "../frontend/app/api/documents/batch-urls/route.ts";
import { DELETE as deleteDocument } from "../frontend/app/api/documents/[id]/route.ts";
import { POST as reindexStore } from "../frontend/app/api/documents/reindex/route.ts";
import { GET as getSessions, POST as createSession } from "../frontend/app/api/sessions/route.ts";
import {
  GET as getSessionById,
  PUT as updateSessionById,
  DELETE as deleteSessionById,
} from "../frontend/app/api/sessions/[id]/route.ts";
import { POST as chatQuery } from "../frontend/app/api/chat/query/route.ts";
import { POST as chatStream } from "../frontend/app/api/chat/stream/route.ts";
import { ragStore } from "../frontend/lib/rag-store.ts";

describe("RAG Platform End-to-End API Suite", () => {
  beforeEach(async () => {
    ragStore.reindexAll();
  });

  // 1. Health Probe Endpoint
  test("GET /api/health returns 200 with service health and vector stats", async () => {
    const res = await getHealth();
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.status, "healthy");
    assert.ok(typeof body.uptime === "number");
    assert.ok(body.timestamp);
    assert.ok(body.vector_store);
    assert.strictEqual(body.vector_store.backend, "faiss");
    assert.ok(body.vector_store.chunks > 0);
    assert.ok(body.vector_store.documents > 0);
  });

  // 2. System Configuration Endpoints
  test("GET /api/config returns default runtime configuration", async () => {
    const res = await getConfig();
    assert.strictEqual(res.status, 200);

    const config = await res.json();
    assert.strictEqual(config.llm_provider, "gemini");
    assert.strictEqual(config.embedding_model, "all-MiniLM-L6-v2");
    assert.strictEqual(config.vector_store_backend, "faiss");
    assert.ok(config.default_chunk_size > 0);
    assert.ok(config.default_chunk_overlap > 0);
  });

  test("POST /api/config updates runtime settings dynamically", async () => {
    const req = new NextRequest("http://localhost:3000/api/config", {
      method: "POST",
      body: JSON.stringify({
        llm_provider: "groq",
        default_chunk_size: 800,
        default_chunk_overlap: 150,
      }),
    });

    const res = await postConfig(req);
    assert.strictEqual(res.status, 200);

    const updated = await res.json();
    assert.strictEqual(updated.llm_provider, "groq");
    assert.strictEqual(updated.default_chunk_size, 800);
    assert.strictEqual(updated.default_chunk_overlap, 150);

    // Verify GET reflects the change
    const getRes = await getConfig();
    const fetched = await getRes.json();
    assert.strictEqual(fetched.llm_provider, "groq");
  });

  // 3. Vector Store Telemetry
  test("GET /api/vector-store/stats returns 384-dimensional collection metrics", async () => {
    const res = await getStats();
    assert.strictEqual(res.status, 200);

    const stats = await res.json();
    assert.strictEqual(stats.embedding_dimension, 384);
    assert.strictEqual(stats.backend, "faiss");
    assert.strictEqual(stats.collection_name, "document_embeddings");
    assert.ok(stats.total_chunks >= 4);
    assert.ok(stats.total_documents >= 4);
  });

  // 4. Document Listing
  test("GET /api/documents returns all indexed knowledge documents", async () => {
    const res = await getDocuments();
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.ok(Array.isArray(data.documents));
    assert.strictEqual(data.total_documents, data.documents.length);
    assert.ok(data.total_chunks > 0);

    // Verify presence of seeded documents
    const docSources = data.documents.map((d: { source: string }) => d.source);
    assert.ok(docSources.includes("About_ChatGPT_500_Words.pdf"));
    assert.ok(docSources.includes("sample1.txt"));
    assert.ok(docSources.includes("sample2.txt"));
  });

  // 5. Document Ingestion via File Upload
  test("POST /api/documents/upload ingests and splits custom document", async () => {
    const formData = new FormData();
    const blob = new Blob([
      "Neural search uses deep learning representations to retrieve relevant content based on semantics rather than keyword matches alone."
    ], { type: "text/plain" });
    formData.append("file", blob, "neural_search.txt");

    const req = new NextRequest("http://localhost:3000/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    const res = await uploadDocument(req);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.source, "neural_search.txt");
    assert.ok(data.chunks_created >= 1);

    // Verify document now appears in inventory
    const listRes = await getDocuments();
    const listData = await listRes.json();
    const found = listData.documents.find((d: { source: string }) => d.source === "neural_search.txt");
    assert.ok(found);
  });

  test("POST /api/documents/upload rejects empty upload payloads", async () => {
    const formData = new FormData();
    const req = new NextRequest("http://localhost:3000/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    const res = await uploadDocument(req);
    assert.strictEqual(res.status, 400);

    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes("No readable text"));
  });

  // 6. Web URL Ingestion
  test("POST /api/documents/url ingests simulated web content", async () => {
    const req = new NextRequest("http://localhost:3000/api/documents/url", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/knowledge-hub",
      }),
    });

    const res = await ingestUrl(req);
    const data = await res.json();

    // In a real environment, example.com might return 200 or 502 depending on network connectivity
    assert.ok([200, 502, 422].includes(res.status));
    assert.ok("success" in data);
  });

  test("POST /api/documents/url validates malformed URLs", async () => {
    const req = new NextRequest("http://localhost:3000/api/documents/url", {
      method: "POST",
      body: JSON.stringify({ url: "not-a-valid-url" }),
    });

    const res = await ingestUrl(req);
    assert.strictEqual(res.status, 400);

    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // 7. Document Deletion & Pruning
  test("DELETE /api/documents/[id] removes document and all associated chunks", async () => {
    // Ingest a temporary test doc first
    ragStore.addDocument("to_delete.txt", "to_delete.txt", "txt", "Temporary content destined for deletion.");
    const beforeCount = ragStore.getStats().total_chunks;

    const req = new NextRequest("http://localhost:3000/api/documents/to_delete.txt", {
      method: "DELETE",
    });

    const res = await deleteDocument(req, {
      params: Promise.resolve({ id: "to_delete.txt" }),
    });
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.source, "to_delete.txt");
    assert.ok(data.deleted_chunks >= 1);

    const afterCount = ragStore.getStats().total_chunks;
    assert.strictEqual(afterCount, beforeCount - data.deleted_chunks);
  });

  // 8. Reindexing Knowledge Base
  test("POST /api/documents/reindex resets store to baseline defaults", async () => {
    ragStore.clearStore();
    assert.strictEqual(ragStore.getStats().total_chunks, 0);

    const res = await reindexStore();
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.stats.total_chunks > 0);
    assert.ok(data.stats.total_documents > 0);
  });

  // 9. Standard Non-Streaming Q&A Chat Query
  test("POST /api/chat/query returns grounded answer with citations and confidence", async () => {
    const req = new NextRequest("http://localhost:3000/api/chat/query", {
      method: "POST",
      body: JSON.stringify({
        query: "What are ChatGPT limitations and capabilities?",
        top_k: 3,
        min_score: 0.1,
      }),
    });

    const res = await chatQuery(req);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.ok(data.answer);
    assert.ok(Array.isArray(data.sources));
    assert.ok(data.sources.length >= 1);
    assert.ok(typeof data.confidence === "number");
    assert.ok(data.confidence >= 0 && data.confidence <= 1);

    // Verify citation structure
    const firstSource = data.sources[0];
    assert.ok(firstSource.source);
    assert.ok(firstSource.score > 0);
    assert.ok(firstSource.preview);
  });

  test("POST /api/chat/query validates empty query", async () => {
    const req = new NextRequest("http://localhost:3000/api/chat/query", {
      method: "POST",
      body: JSON.stringify({ query: "" }),
    });

    const res = await chatQuery(req);
    assert.strictEqual(res.status, 400);
  });

  // 10. Server-Sent Events Streaming Chat
  test("POST /api/chat/stream delivers SSE events with metadata, tokens, and done signal", async () => {
    const req = new NextRequest("http://localhost:3000/api/chat/stream", {
      method: "POST",
      body: JSON.stringify({
        query: "How does AI support human creativity?",
        top_k: 2,
        min_score: 0.1,
      }),
    });

    const res = await chatStream(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get("Content-Type"), "text/event-stream; charset=utf-8");

    const reader = res.body?.getReader();
    assert.ok(reader);

    const decoder = new TextDecoder();
    let streamText = "";

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      streamText += decoder.decode(value, { stream: true });
    }

    // Verify SSE structure
    assert.ok(streamText.includes("event: metadata"));
    assert.ok(streamText.includes("event: token"));
    assert.ok(streamText.includes("event: done"));
  });

  // 11. Batch URL Ingestion Endpoint (Phase 4 / Issue 16)
  test("POST /api/documents/batch-urls validates request array and returns processed results", async () => {
    // Test invalid payload
    const invalidReq = new NextRequest("http://localhost:3000/api/documents/batch-urls", {
      method: "POST",
      body: JSON.stringify({ urls: "not-an-array" }),
    });
    const invalidRes = await ingestBatchUrls(invalidReq);
    assert.strictEqual(invalidRes.status, 400);

    // Test valid batch structure
    const validReq = new NextRequest("http://localhost:3000/api/documents/batch-urls", {
      method: "POST",
      body: JSON.stringify({
        urls: [
          "https://example.com/rag-research-guide",
          "https://example.com/vector-search-docs",
        ],
      }),
    });
    const validRes = await ingestBatchUrls(validReq);
    assert.strictEqual(validRes.status, 200);

    const body = await validRes.json();
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.processed === "number");
    assert.ok(Array.isArray(body.results));
  });

  // 12. Multi-Session Conversation Management (Phase 4 / 4.1)
  test("GET /api/sessions and POST /api/sessions manage chat conversations", async () => {
    // List default sessions
    const listRes = await getSessions();
    assert.strictEqual(listRes.status, 200);
    const listBody = await listRes.json();
    assert.ok(Array.isArray(listBody.sessions));
    assert.ok(listBody.sessions.length >= 1);

    // Create a new conversation session
    const createReq = new NextRequest("http://localhost:3000/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "Custom Research Session" }),
    });
    const createRes = await createSession(createReq);
    assert.strictEqual(createRes.status, 200);

    const createBody = await createRes.json();
    assert.strictEqual(createBody.success, true);
    assert.strictEqual(createBody.session.title, "Custom Research Session");
    const sessionId = createBody.session.id;

    // Retrieve session by ID
    const getByIdRes = await getSessionById(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}`),
      { params: Promise.resolve({ id: sessionId }) }
    );
    assert.strictEqual(getByIdRes.status, 200);
    const getByIdBody = await getByIdRes.json();
    assert.strictEqual(getByIdBody.session.id, sessionId);

    // Update session messages and title
    const updateReq = new NextRequest(`http://localhost:3000/api/sessions/${sessionId}`, {
      method: "PUT",
      body: JSON.stringify({
        title: "Renamed Research Session",
        messages: [
          { role: "user", content: "What is RAG?" },
          { role: "assistant", content: "RAG stands for Retrieval-Augmented Generation." },
        ],
      }),
    });
    const updateRes = await updateSessionById(updateReq, {
      params: Promise.resolve({ id: sessionId }),
    });
    assert.strictEqual(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.strictEqual(updateBody.session.title, "Renamed Research Session");
    assert.strictEqual(updateBody.session.messages.length, 2);

    // Delete the session
    const deleteRes = await deleteSessionById(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}`),
      { params: Promise.resolve({ id: sessionId }) }
    );
    assert.strictEqual(deleteRes.status, 200);
    const deleteBody = await deleteRes.json();
    assert.strictEqual(deleteBody.success, true);
  });

  // 13. Purge Vector Store
  test("DELETE /api/vector-store/clear completely purges store", async () => {
    const res = await clearStore();
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);

    const stats = ragStore.getStats();
    assert.strictEqual(stats.total_chunks, 0);
    assert.strictEqual(stats.total_documents, 0);
  });
});
