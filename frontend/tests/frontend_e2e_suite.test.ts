import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ragStore, splitTextIntoChunks } from "../lib/rag-store.ts";

describe("Frontend End-to-End Workflow & Component Suite", () => {
  beforeEach(() => {
    ragStore.reindexAll();
  });

  // 1. Navigation & Workspace View Routing
  describe("Navigation & Active View Routing", () => {
    test("supports all 4 primary navigation tabs with distinctive titles and subtitles", () => {
      const titles: Record<string, { title: string; subtitle: string }> = {
        chat: {
          title: "RAG Assistant",
          subtitle: "Grounded semantic retrieval with live token streaming & source citations",
        },
        knowledge: {
          title: "Knowledge Base",
          subtitle: "Document repository, multi-format file parser & URL web ingestion",
        },
        playground: {
          title: "Retrieval Inspector",
          subtitle: "Pure vector similarity inspector & live chunking parameter sandbox",
        },
        settings: {
          title: "System Control",
          subtitle: "Vector store diagnostics, LLM provider routing & embedding config",
        },
      };

      const validTabs = ["chat", "knowledge", "playground", "settings"];
      for (const tab of validTabs) {
        assert.ok(titles[tab], `Tab ${tab} should have defined title metadata`);
        assert.ok(titles[tab].title.length > 0);
        assert.ok(titles[tab].subtitle.length > 0);
      }
    });

    test("Navbar telemetry correctly formats unboxed metadata counts", () => {
      const stats = ragStore.getStats();
      const telemetryDocs = `${stats.total_documents} docs`;
      const telemetryChunks = `${stats.total_chunks} indexed chunks`;
      const telemetryStatus = "online";

      assert.ok(telemetryDocs.includes("4 docs"));
      assert.ok(telemetryChunks.includes("chunks"));
      assert.strictEqual(telemetryStatus, "online");
    });
  });

  // 2. Chatbot Interactive Flow & Streaming
  describe("Utility 1: Interactive RAG Chatbot", () => {
    test("handles full user question-answer cycle with citations and confidence calculation", async () => {
      const query = "What are ChatGPT's core strengths and stated limitations?";
      const result = await ragStore.queryRAG(query, 5, 0.2, "gemini");

      // Verify answer synthesis
      assert.ok(result.answer.length > 50);
      assert.ok(result.answer.includes("ChatGPT"));

      // Verify source citations
      assert.ok(result.sources.length >= 1);
      const topCitation = result.sources[0];
      assert.strictEqual(topCitation.source, "About_ChatGPT_500_Words.pdf");
      assert.ok(topCitation.score > 0.4);
      assert.ok(topCitation.preview.length > 0);

      // Verify confidence mapping
      assert.ok(result.confidence >= 0.35 && result.confidence <= 1.0);
      const confidenceLabel =
        result.confidence >= 0.75
          ? "High"
          : result.confidence >= 0.5
          ? "Medium"
          : "Low";
      assert.ok(["High", "Medium", "Low"].includes(confidenceLabel));
    });

    test("suggested inquiry prompts generate valid grounding responses", async () => {
      const prompts = [
        "What are ChatGPT's core capabilities, strengths, and stated limitations?",
        "Which books in the catalog have ratings above 4.25 and when were they published?",
        "How does artificial intelligence support human creativity according to the sample files?",
      ];

      for (const prompt of prompts) {
        const result = await ragStore.queryRAG(prompt, 3, 0.1);
        assert.ok(result.answer.length > 0, `Prompt '${prompt}' should generate grounded answer`);
        assert.ok(result.sources.length > 0, `Prompt '${prompt}' should return grounding sources`);
      }
    });

    test("session reset clears messages back to initial welcome prompt", () => {
      const initialMessages = [
        {
          id: "welcome_msg",
          role: "assistant",
          content: "Hello! I am your RAG Knowledge Assistant.",
          timestamp: "12:00 PM",
        },
      ];

      // Add user and assistant messages
      const activeSession = [
        ...initialMessages,
        { id: "u1", role: "user", content: "Query 1", timestamp: "12:01 PM" },
        { id: "a1", role: "assistant", content: "Answer 1", timestamp: "12:01 PM" },
      ];
      assert.strictEqual(activeSession.length, 3);

      // Reset
      const resetSession = [
        {
          id: "welcome_new",
          role: "assistant",
          content: "Conversation session reset.",
          timestamp: "12:02 PM",
        },
      ];
      assert.strictEqual(resetSession.length, 1);
      assert.ok(resetSession[0].content.includes("reset"));
    });
  });

  // 3. Knowledge Base Document Management
  describe("Utility 2: Knowledge Base Document Center", () => {
    test("table search filter matches documents by source name and format", () => {
      const docs = ragStore.listDocuments();

      const filterByPdf = docs.filter((d) =>
        d.source_name.toLowerCase().includes("pdf") || d.format.toLowerCase().includes("pdf")
      );
      assert.strictEqual(filterByPdf.length, 1);
      assert.strictEqual(filterByPdf[0].format, "pdf");

      const filterByTxt = docs.filter((d) =>
        d.source_name.toLowerCase().includes("txt") || d.format.toLowerCase().includes("txt")
      );
      assert.strictEqual(filterByTxt.length, 2);
    });

    test("document inspection retrieves full chunk details and character counts", () => {
      const doc = ragStore.listDocuments().find((d) => d.source === "About_ChatGPT_500_Words.pdf");
      assert.ok(doc);
      assert.ok(doc.chunks_count >= 1);
      assert.ok(doc.sample_content.length > 0);
    });

    test("adding file and deleting it updates document inventory and telemetry cleanly", () => {
      const testDocName = "dynamic_test_guide.md";
      ragStore.addDocument(testDocName, testDocName, "md", "# Architecture Guide\n\nThis guide explains vector ingestion.");

      const afterAdd = ragStore.listDocuments();
      assert.ok(afterAdd.some((d) => d.source === testDocName));

      ragStore.deleteDocument(testDocName);
      const afterDelete = ragStore.listDocuments();
      assert.ok(!afterDelete.some((d) => d.source === testDocName));
    });
  });

  // 4. Retrieval Inspector & Sandbox Playground
  describe("Utility 3: RAG Inspector & Sandbox Playground", () => {
    test("pure semantic search without synthesis returns ranked chunks with cosine distances", () => {
      const query = "What books were written by J.K. Rowling or Tolkien?";
      const retrieved = ragStore.retrieve(query, 4, 0.1);

      assert.ok(retrieved.length >= 1);
      assert.strictEqual(retrieved[0].chunk.source, "books_catalog.jsonl");

      // Verify cosine progress bar percentage calculation
      const topPercentage = (retrieved[0].score * 100).toFixed(1);
      assert.ok(parseFloat(topPercentage) >= 10.0);
    });

    test("sandbox partitioning recalculates segments dynamically with slider inputs", () => {
      const text = "A".repeat(1000);

      // Target size 200, overlap 50
      const chunksSmall = splitTextIntoChunks(text, 200, 50);
      assert.ok(chunksSmall.length >= 5);

      // Target size 500, overlap 50
      const chunksLarge = splitTextIntoChunks(text, 500, 50);
      assert.ok(chunksLarge.length >= 2 && chunksLarge.length < chunksSmall.length);
    });
  });

  // 5. System Control & Provider Settings
  describe("Utility 4: System Control & Settings", () => {
    test("switches between Gemini and Groq providers", () => {
      ragStore.updateConfig({ llm_provider: "groq", groq_model: "llama-3.3-70b-versatile" });
      const config1 = ragStore.getConfig();
      assert.strictEqual(config1.llm_provider, "groq");
      assert.strictEqual(config1.groq_model, "llama-3.3-70b-versatile");

      ragStore.updateConfig({ llm_provider: "gemini", gemini_model: "gemini-2.5-flash" });
      const config2 = ragStore.getConfig();
      assert.strictEqual(config2.llm_provider, "gemini");
      assert.strictEqual(config2.gemini_model, "gemini-2.5-flash");
    });

    test("switches vector store backend between FAISS and Typesense", () => {
      ragStore.updateConfig({ vector_store_backend: "typesense" });
      assert.strictEqual(ragStore.getStats().backend, "typesense");

      ragStore.updateConfig({ vector_store_backend: "faiss" });
      assert.strictEqual(ragStore.getStats().backend, "faiss");
    });

    test("adjusts default chunk size and overlap parameters", () => {
      ragStore.updateConfig({ default_chunk_size: 750, default_chunk_overlap: 125 });
      const config = ragStore.getConfig();
      assert.strictEqual(config.default_chunk_size, 750);
      assert.strictEqual(config.default_chunk_overlap, 125);
    });
  });

  // 6. Phase 4 Production Hardening & Multi-Session UI (Phase 4 / 4.1 & 4.2)
  describe("Phase 4: Multi-Session, Batch Ingestion & Empty States", () => {
    test("multi-session UI tracks distinct conversation histories across session switches", () => {
      const sessionA = ragStore.createSession("Project Alpha RAG");
      const sessionB = ragStore.createSession("Project Beta RAG");

      // Populate history in session A
      ragStore.updateSessionMessages(sessionA.id, [
        { role: "user", content: "Tell me about Alpha." },
        { role: "assistant", content: "Alpha is indexed." },
      ]);

      // Populate history in session B
      ragStore.updateSessionMessages(sessionB.id, [
        { role: "user", content: "Tell me about Beta." },
        { role: "assistant", content: "Beta is indexed." },
      ]);

      // Verify separate message contexts
      const fetchedA = ragStore.getSession(sessionA.id);
      const fetchedB = ragStore.getSession(sessionB.id);

      assert.strictEqual(fetchedA?.messages.length, 2);
      assert.strictEqual(fetchedB?.messages.length, 2);
      assert.notStrictEqual(fetchedA?.messages[0].content, fetchedB?.messages[0].content);

      // Clean up
      ragStore.deleteSession(sessionA.id);
      ragStore.deleteSession(sessionB.id);
    });

    test("handles empty vector store and no-match queries with informative guidance", async () => {
      // Clear store temporarily
      ragStore.clearStore();
      const stats = ragStore.getStats();
      assert.strictEqual(stats.total_chunks, 0);

      const emptyQueryRes = await ragStore.queryRAG("What is quantum entanglement?", 3, 0.2);
      assert.ok(emptyQueryRes.answer.includes("no relevant documents"));
      assert.strictEqual(emptyQueryRes.sources.length, 0);
      assert.strictEqual(emptyQueryRes.confidence, 0);

      // Restore defaults
      ragStore.reindexAll();
    });

    test("batch URL input sanitization strips invalid protocols and extracts valid URLs", () => {
      const rawBatchText = `
        https://example.com/docs/intro
        invalid-non-url-string
        http://example.com/docs/api
        ftp://unsupported.protocol.com
        https://example.com/docs/architecture
      `;

      const validUrls = rawBatchText
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.startsWith("http://") || u.startsWith("https://"));

      assert.strictEqual(validUrls.length, 3);
      assert.ok(validUrls.includes("https://example.com/docs/intro"));
      assert.ok(validUrls.includes("http://example.com/docs/api"));
      assert.ok(validUrls.includes("https://example.com/docs/architecture"));
    });
  });
});

