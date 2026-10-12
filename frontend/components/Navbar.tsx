"use client";

import React from "react";
import { Database, ShieldCheck, RefreshCw } from "lucide-react";

interface NavbarProps {
  activeTab: string;
  backendStatus: string;
  totalChunks: number;
  totalDocs: number;
  onRefreshStats: () => void;
  isRefreshing: boolean;
}

export function Navbar({
  activeTab,
  backendStatus,
  totalChunks,
  totalDocs,
  onRefreshStats,
  isRefreshing,
}: NavbarProps) {
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

  const current = titles[activeTab] || titles.chat;

  return (
    <header className="h-16 px-6 border-b border-slate-800 bg-slate-950/70 backdrop-blur-md flex items-center justify-between gap-6 shrink-0 z-10">
      {/* Zone 1: Contextual Title & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <h1 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>{current.title}</span>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-normal text-slate-400 truncate max-w-md hidden sm:inline">
              {current.subtitle}
            </span>
          </h1>
        </div>
      </div>

      {/* Zone 2: Telemetry & State (Zero-Pill Unboxed Text with Separators) */}
      <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 tabular-nums">
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-300 font-medium">{totalDocs}</span>
          <span>docs</span>
        </div>
        <span className="text-slate-700" aria-hidden="true">·</span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-300 font-medium">{totalChunks}</span>
          <span>indexed chunks</span>
        </div>
        <span className="text-slate-700" aria-hidden="true">·</span>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400 font-medium capitalize">{backendStatus}</span>
        </div>
      </div>

      {/* Zone 3: Primary Quick Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onRefreshStats}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh store telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
          <span className="hidden sm:inline">Sync Store</span>
        </button>
      </div>
    </header>
  );
}
