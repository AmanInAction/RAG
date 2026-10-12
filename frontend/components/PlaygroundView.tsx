"use client";

import React, { useState } from "react";
import {
  Search,
  Scissors,
  ArrowRight,
} from "lucide-react";
import { splitTextIntoChunks } from "@/lib/rag-store";

interface RetrievalResult {
  chunk: {
    id: string;
    source_name: string;
    chunk_index: number;
    content: string;
    char_count?: number;
  };
  score: number;
}

export function PlaygroundView() {
  // Utility 3A: Pure Semantic Search Inspector
  const [inspectorQuery, setInspectorQuery] = useState(
    "How does artificial intelligence assist in problem solving?"
  );
  const [topK, setTopK] = useState(4);
  const [minScore, setMinScore] = useState(0.15);
  const [searchResults, setSearchResults] = useState<RetrievalResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Utility 3B: Interactive Chunking Sandbox
  const [sampleText, setSampleText] = useState(
    `Retrieval-Augmented Generation (RAG) is a technique that enhances large language models by grounding their responses in external, authoritative knowledge bases. 

When a user submits a query, the system first transforms the question into a high-dimensional vector using an embedding model. Next, it searches a vector database (such as FAISS or Typesense) using cosine similarity or approximate nearest neighbor algorithms to find the most relevant document chunks.

Finally, the retrieved chunks are formatted alongside the user query into a synthesized prompt for the LLM. This architecture prevents hallucination, ensures answers remain up to date, and provides verifiable citations back to the source documents.`
  );
  const [sandboxChunkSize, setSandboxChunkSize] = useState(300);
  const [sandboxOverlap, setSandboxOverlap] = useState(60);

  const previewChunks = splitTextIntoChunks(
    sampleText,
    sandboxChunkSize,
    sandboxOverlap
  );

  const handleInspectRetrieval = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inspectorQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Direct call to query API with provider="none" or extracting retrieved sources
      const res = await fetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: inspectorQuery.trim(),
          top_k: topK,
          min_score: minScore,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const mappedResults: RetrievalResult[] = (data.sources || []).map(
          (s: { source: string; page: number | string; score: number; preview: string }, i: number) => ({
            chunk: {
              id: `chunk_${i}`,
              source_name: s.source,
              chunk_index: Number(s.page) - 1 || i,
              content: s.preview,
              char_count: s.preview.length,
            },
            score: s.score,
          })
        );
        setSearchResults(mappedResults);
      }
    } catch (err) {
      console.warn("Search inspection failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-950 space-y-8">
      {/* SECTION 1: Semantic Retrieval Inspector */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-400" />
              <span>Vector Similarity Retrieval Inspector</span>
            </h2>
            <span className="text-[11px] text-slate-400">Zero-LLM Direct Semantic Search</span>
          </div>
          <p className="text-xs text-slate-400">
            Audit pure cosine similarity rankings, threshold cutoffs, and retrieved chunk payloads before any generative synthesis.
          </p>
        </div>

        {/* Inspector Query Bar */}
        <form onSubmit={handleInspectRetrieval} className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                value={inspectorQuery}
                onChange={(e) => setInspectorQuery(e.target.value)}
                placeholder="Enter query to test raw cosine retrieval..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !inspectorQuery.trim()}
              className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-2"
            >
              <span>{isSearching ? "Searching..." : "Inspect Chunks"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sliders Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Top-K Retrieved (1–10)</span>
                <span className="font-mono text-cyan-400 font-semibold">{topK}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Minimum Similarity Threshold</span>
                <span className="font-mono text-cyan-400 font-semibold">
                  {(minScore * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.80"
                step="0.05"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </form>

        {/* Search Results Display */}
        {hasSearched && (
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Retrieved Chunks ({searchResults.length} match{searchResults.length !== 1 ? "es" : ""})</span>
              <span className="text-[11px] text-slate-500">Sorted by Cosine Distance</span>
            </div>

            {searchResults.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                No chunks met the similarity threshold of {(minScore * 100).toFixed(0)}%. Try lowering the threshold or adjusting search query terms.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {searchResults.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500">#{idx + 1}</span>
                        <span className="font-medium text-slate-200">{res.chunk.source_name}</span>
                        <span className="text-slate-700">·</span>
                        <span className="text-slate-500 text-[11px]">Chunk {res.chunk.chunk_index + 1}</span>
                      </div>

                      {/* Cosine Score Bar */}
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-400 rounded-full"
                            style={{ width: `${Math.min(100, res.score * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-cyan-400 font-semibold tabular-nums text-xs">
                          {(res.score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-300 text-xs leading-relaxed bg-slate-900/40 p-3 rounded border border-slate-900 font-mono">
                      {res.chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2: Text Chunking Visualizer & Sandbox */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-cyan-400" />
              <span>Document Chunking & Partitioning Sandbox</span>
            </h2>
            <span className="text-[11px] text-slate-400">Recursive Sentence Boundary Visualizer</span>
          </div>
          <p className="text-xs text-slate-400">
            Tune chunk size and overlap parameters in real time to understand how raw texts are segmented prior to embedding.
          </p>
        </div>

        {/* Sliders for Sandbox */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Target Chunk Size (Characters)</span>
              <span className="font-mono text-cyan-400 font-semibold">{sandboxChunkSize} chars</span>
            </div>
            <input
              type="range"
              min="150"
              max="1200"
              step="50"
              value={sandboxChunkSize}
              onChange={(e) => setSandboxChunkSize(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Overlap Window (Characters)</span>
              <span className="font-mono text-cyan-400 font-semibold">{sandboxOverlap} chars</span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              step="10"
              value={sandboxOverlap}
              onChange={(e) => setSandboxOverlap(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Input Text Area */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            Raw Sample Text Payload
          </label>
          <textarea
            rows={5}
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono leading-relaxed"
          />
        </div>

        {/* Chunks Breakdown Grid */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Resulting Chunks ({previewChunks.length} partitioned segments)</span>
            <span className="text-[11px] text-slate-500">
              Avg ~{Math.round(sampleText.length / Math.max(1, previewChunks.length))} chars / chunk
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {previewChunks.map((chunkText, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/90 text-xs space-y-2 relative"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                  <span className="font-semibold text-cyan-400">Chunk {idx + 1}</span>
                  <span className="font-mono">{chunkText.length} characters</span>
                </div>
                <p className="text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                  {chunkText}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
