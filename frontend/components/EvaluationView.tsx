"use client";

import React, { useEffect, useState } from "react";
import { FlaskConical, Play, Save, Search, Copy, AlertCircle } from "lucide-react";

type Case = { id?: string; query: string; relevant_chunk_ids: string[]; reference_answer?: string; reference_contexts?: string[] };
type Report = { dataset_name: string; dataset_cases: number; provider: string; metrics: Record<string, any>; cases: any[] };

const emptyDataset = { name: "Custom RAG benchmark", cases: [] as Case[] };
const fmt = (v: any) => typeof v === "number" ? (v * 100).toFixed(1) + "%" : "—";

export function EvaluationView() {
  const [datasetText, setDatasetText] = useState(JSON.stringify(emptyDataset, null, 2));
  const [datasetCount, setDatasetCount] = useState(0);
  const [query, setQuery] = useState("");
  const [chunks, setChunks] = useState<any[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [topK, setTopK] = useState(5);
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/evaluation/dataset").then(r => r.json()).then(d => {
      setDatasetText(JSON.stringify(d, null, 2));
      setDatasetCount(Array.isArray(d.cases) ? d.cases.length : 0);
    }).catch(() => setError("Could not load benchmark dataset."));
    fetch("/api/evaluation/latest").then(r => r.ok ? r.json() : null).then(d => { if (d) setReport(d); }).catch(() => undefined);
  }, []);

  async function saveDataset() {
    setError(""); setNotice("");
    try {
      const parsed = JSON.parse(datasetText);
      const response = await fetch("/api/evaluation/dataset", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Dataset save failed.");
      setDatasetText(JSON.stringify(data, null, 2)); setDatasetCount(data.cases.length); setNotice("Benchmark dataset saved.");
    } catch (e: any) { setError(e.message || "Invalid dataset JSON."); }
  }

  async function inspect() {
    if (!query.trim()) return;
    setBusy(true); setError(""); setChunks([]);
    try {
      const response = await fetch("/api/evaluation/inspect?query=" + encodeURIComponent(query) + "&top_k=10");
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Inspection failed.");
      setChunks(data.chunks || []);
    } catch (e: any) { setError(e.message || "Inspection failed."); }
    finally { setBusy(false); }
  }

  async function run() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/evaluation/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ top_k: topK, min_score: 0, provider: provider || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Evaluation failed.");
      setReport(data); setNotice("Evaluation completed and report saved.");
    } catch (e: any) { setError(e.message || "Evaluation failed."); }
    finally { setBusy(false); }
  }

  const m = report?.metrics || {};
  const cards = [
    ["Recall@k", fmt(m.recall_at_k), "Exact chunk labels"],
    ["MRR", m.mrr == null ? "—" : Number(m.mrr).toFixed(3), "First relevant rank"],
    ["Faithfulness", fmt(m.faithfulness), "LLM judge"],
    ["Answer relevance", fmt(m.answer_relevance), "LLM judge"],
    ["Context precision", fmt(m.context_precision), "Ground-truth ranked precision"],
    ["Context relevance", fmt(m.context_relevance), "LLM judge"],
    ["Retrieval latency", m.latency_ms ? m.latency_ms.retrieval_avg + " ms" : "—", "Average"],
    ["Generation latency", m.latency_ms ? m.latency_ms.generation_avg + " ms" : "—", "Average"]
  ];

  return <div className="flex-1 overflow-y-auto bg-slate-950 px-6 py-6 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><FlaskConical className="h-4 w-4 text-cyan-400"/> RAG Evaluation Lab</h2><p className="mt-1 text-xs text-slate-400">Benchmark the live Python retrieval and generation pipeline with your own labelled questions.</p></div>
      <button onClick={run} disabled={busy || datasetCount === 0} className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-40"><Play className="h-3.5 w-3.5"/>{busy ? "Working..." : "Run evaluation"}</button>
    </header>
    {error && <div className="flex gap-2 rounded-lg border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</div>}
    {notice && <p className="text-xs text-emerald-400">{notice}</p>}
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div><h3 className="text-xs font-semibold text-slate-100">1. Custom benchmark dataset</h3><p className="mt-1 text-[11px] text-slate-500">Add question cases with exact relevant chunk IDs. Start empty rather than scoring placeholder data.</p></div>
      <textarea value={datasetText} onChange={e => setDatasetText(e.target.value)} rows={13} spellCheck={false} className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300 outline-none focus:border-cyan-500/50"/>
      <div className="flex flex-wrap items-center gap-3"><button onClick={saveDataset} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"><Save className="h-3.5 w-3.5"/>Save dataset</button><span className="text-[11px] text-slate-500">{datasetCount} saved cases · 30–50 diverse cases recommended</span></div>
    </section>
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div><h3 className="text-xs font-semibold text-slate-100">2. Inspect actual retrieved chunks</h3><p className="mt-1 text-[11px] text-slate-500">Use a real question, then copy IDs for every chunk that contains evidence needed to answer it.</p></div>
      <div className="flex gap-2"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") inspect(); }} placeholder="Enter a benchmark question..." className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none"/><button onClick={inspect} disabled={busy || !query.trim()} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 disabled:opacity-40"><Search className="h-3.5 w-3.5"/>Inspect</button></div>
      {chunks.map(c => <div key={c.chunk_id} className="space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="flex flex-wrap items-center justify-between gap-2 text-[11px]"><span className="font-mono text-cyan-300">#{c.rank} · {c.chunk_id}</span><span className="text-slate-500">{c.source} · {c.similarity_score}</span><button onClick={() => navigator.clipboard.writeText(c.chunk_id)} className="flex items-center gap-1 text-cyan-400"><Copy className="h-3 w-3"/>Copy ID</button></div><p className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">{c.content}</p></div>)}
    </section>
    <section className="flex flex-wrap items-center gap-5 rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-xs">
      <label className="flex items-center gap-2 text-slate-400">Top-k <select value={topK} onChange={e => setTopK(Number(e.target.value))} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200">{[3,5,8,10,15,20].map(n => <option key={n}>{n}</option>)}</select></label>
      <label className="flex items-center gap-2 text-slate-400">Provider <select value={provider} onChange={e => setProvider(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"><option value="">Default</option><option value="gemini">Gemini</option><option value="groq">Groq</option></select></label>
    </section>
    {report && <section className="space-y-4">
      <div><h3 className="text-sm font-semibold text-slate-100">Latest evaluation results</h3><p className="text-[11px] text-slate-500">{report.dataset_name} · {report.dataset_cases} cases · {report.provider}</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label,value,detail]) => <div key={label} className="space-y-1 rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div><div className="text-xl font-semibold tabular-nums text-slate-100">{value}</div><div className="text-[11px] text-slate-500">{detail}</div></div>)}</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{[
        ["Total latency", m.latency_ms?.total_avg == null ? "—" : m.latency_ms.total_avg + " ms"],
        ["Estimated tokens", m.token_usage ? (m.token_usage.input_tokens_estimated + m.token_usage.output_tokens_estimated).toLocaleString() : "—"],
        ["Estimated API cost", m.api_cost?.estimated_cost == null ? "Not configured" : m.api_cost.currency + " " + m.api_cost.estimated_cost]
      ].map(([label,value]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="text-[10px] uppercase text-slate-500">{label}</div><div className="mt-1 text-lg font-semibold text-slate-100">{value}</div></div>)}</div>
      <p className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-[11px] text-amber-200/80">Token counts are character-based estimates, not provider-reported usage; judge-call tokens are excluded. Cost remains unavailable until model-specific rates are configured. Ingestion latency is not part of this query benchmark.</p>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3"><h4 className="text-xs font-semibold text-slate-200">Per-question results</h4>{report.cases?.map((c:any) => <div key={c.id} className="space-y-1 border-t border-slate-800 pt-3"><div className="text-xs text-slate-200">{c.query}</div><div className="flex flex-wrap gap-3 text-[11px] text-slate-500"><span>Recall {c.recall_at_k ?? "—"}</span><span>MRR {c.mrr ?? "—"}</span><span>Faithfulness {c.faithfulness ?? "—"}</span><span>Relevance {c.answer_relevance ?? "—"}</span><span>{c.latency_ms?.total} ms</span></div></div>)}</div>
    </section>}
  </div>;
}
