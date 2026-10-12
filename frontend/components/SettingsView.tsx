"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Database,
  Cpu,
  CheckCircle,
  RefreshCw,
  Trash2,
  Activity,
  Save,
  Layers,
} from "lucide-react";

interface SettingsViewProps {
  activeProvider: string;
  setActiveProvider: (p: string) => void;
  activeBackend: string;
  setActiveBackend: (b: string) => void;
  onStoreCleared: () => void;
}

export function SettingsView({
  activeProvider,
  setActiveProvider,
  activeBackend,
  setActiveBackend,
  onStoreCleared,
}: SettingsViewProps) {
  const [geminiModel, setGeminiModel] = useState("gemini-3.8-flash");
  const [groqModel, setGroqModel] = useState("llama-3.3-70b-versatile");
  const [chunkSize, setChunkSize] = useState(600);
  const [chunkOverlap, setChunkOverlap] = useState(100);

  const [stats, setStats] = useState({
    total_chunks: 0,
    total_documents: 0,
    embedding_dimension: 384,
    embedding_model_id: "all-MiniLM-L6-v2",
    backend: "faiss",
  });

  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [isTestingHealth, setIsTestingHealth] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/vector-store/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn("Failed to fetch store stats", err);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch("/api/vector-store/stats")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setStats(data);
      })
      .catch((err) => {
        console.warn("Failed to fetch store stats", err);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleTestHealth = async () => {
    setIsTestingHealth(true);
    setHealthStatus(null);
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setHealthStatus(
          `Healthy · Uptime ${Math.round(data.uptime)}s · Vectors: ${data.vector_store.chunks} chunks · Store: ${data.vector_store.backend}`
        );
      } else {
        setHealthStatus("Warning: Health check returned non-200 status");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setHealthStatus(`Error: ${msg}`);
    } finally {
      setIsTestingHealth(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm_provider: activeProvider,
          gemini_model: geminiModel,
          groq_model: groqModel,
          vector_store_backend: activeBackend,
          default_chunk_size: chunkSize,
          default_chunk_overlap: chunkOverlap,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.warn("Failed to save config", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearStore = async () => {
    if (
      !confirm(
        "Are you sure you want to completely purge and clear all vectors and indexed documents?"
      )
    ) {
      return;
    }

    try {
      const res = await fetch("/api/vector-store/clear", { method: "DELETE" });
      if (res.ok) {
        fetchStats();
        onStoreCleared();
      }
    } catch (err) {
      console.warn("Failed to clear store", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-950 space-y-6">
      <form onSubmit={handleSaveConfig} className="space-y-6">
        {/* Section 1: LLM Provider Configuration */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>LLM Synthesis Provider Routing</span>
            </h2>
            <span className="text-[11px] text-slate-400">Multi-Model Engine</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Provider Switch */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Primary Model Provider
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveProvider("gemini")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                    activeProvider === "gemini"
                      ? "bg-slate-800 text-cyan-400 border border-cyan-800"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  Google Gemini
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProvider("groq")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                    activeProvider === "groq"
                      ? "bg-slate-800 text-cyan-400 border border-cyan-800"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  Groq (LLaMA)
                </button>
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                Active provider for streaming answers against retrieved context.
              </p>
            </div>

            {/* Model Target */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Model Identifier
              </label>
              {activeProvider === "gemini" ? (
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Latest Default)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Cost-Effective)</option>
                </select>
              ) : (
                <select
                  value={groqModel}
                  onChange={(e) => setGroqModel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono"
                >
                  <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                  <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                </select>
              )}
              <p className="text-[11px] text-slate-400 pt-1">
                Configured model identifier passed to SDK generation calls.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Vector Store Backend & Chunking */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Vector Database Backend & Embeddings</span>
            </h2>
            <span className="text-[11px] text-slate-400">FAISS / Typesense</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Vector Storage Backend
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveBackend("faiss")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                    activeBackend === "faiss"
                      ? "bg-slate-800 text-cyan-400 border border-cyan-800"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  FAISS (Local In-Memory)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBackend("typesense")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                    activeBackend === "typesense"
                      ? "bg-slate-800 text-cyan-400 border border-cyan-800"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  Typesense (Cloud/Cluster)
                </button>
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                FAISS runs locally with cosine indexing; Typesense connects via HTTP API.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="text-slate-300 font-medium">Embedding Architecture</div>
              <div className="space-y-1.5 text-slate-400 text-[11px]">
                <div className="flex justify-between">
                  <span>Model ID:</span>
                  <span className="font-mono text-slate-200">all-MiniLM-L6-v2</span>
                </div>
                <div className="flex justify-between">
                  <span>Embedding Dimension:</span>
                  <span className="font-mono text-cyan-400">384 dimensions</span>
                </div>
                <div className="flex justify-between">
                  <span>Distance Metric:</span>
                  <span className="font-mono text-slate-200">Cosine Similarity (Normalized)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chunking Parameters Tuning */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
            <div className="text-xs font-medium text-slate-300 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Default Document Chunking Parameters</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Default Chunk Size:</span>
                  <span className="font-mono text-cyan-400 font-semibold">{chunkSize} characters</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="1500"
                  step="50"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Default Chunk Overlap:</span>
                  <span className="font-mono text-cyan-400 font-semibold">{chunkOverlap} characters</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="300"
                  step="10"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Live Store Diagnostics & System Health */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Store Diagnostics & Maintenance</span>
            </h2>
            <button
              type="button"
              onClick={handleTestHealth}
              disabled={isTestingHealth}
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-medium"
            >
              <RefreshCw className={`w-3 h-3 ${isTestingHealth ? "animate-spin" : ""}`} />
              <span>Probe Health</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[11px]">Total Chunks</div>
              <div className="text-base font-semibold text-cyan-400 font-mono mt-0.5">
                {stats.total_chunks}
              </div>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[11px]">Indexed Documents</div>
              <div className="text-base font-semibold text-slate-200 font-mono mt-0.5">
                {stats.total_documents}
              </div>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[11px]">Vector Dimensions</div>
              <div className="text-base font-semibold text-slate-200 font-mono mt-0.5">
                384
              </div>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[11px]">Index Status</div>
              <div className="text-base font-semibold text-emerald-400 font-mono mt-0.5">
                Online
              </div>
            </div>
          </div>

          {healthStatus && (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
              {healthStatus}
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
            <button
              type="button"
              onClick={handleClearStore}
              className="px-3.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-900 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge Vector Store</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-slate-950" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? "Saving..." : "Save Settings"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
