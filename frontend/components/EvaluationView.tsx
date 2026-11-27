"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Activity, BookOpenCheck, CheckCircle2, CircleAlert, FlaskConical, Play, Save, Search, Timer, Coins } from "lucide-react";

type BenchmarkCase = {
  id?: string;
  query: string;
  relevant_chunk_ids: string[];
  reference_answer?: string;
  reference_contexts?: string[];
};

type Report = {
  dataset_name: string;
  dataset_cases: number;
  provider: string;
  metrics: Record<string, any>;
  cases: any[];
  scoring_notes?: Record<string, string>;
};

const starter = {
  name: "Custom RAG benchmark",
  cases: [
    {
      id: "example-01",
      query: "Replace this with a question answerable from your indexed documents.",
      relevant_chunk_ids: ["paste-an-exact-chunk-id-from-retrieval-inspection"],
      reference_answer: "Write the expected answer, grounded in the document.",
      reference_contexts: ["Optionally paste the exact evidence passage."]
    }
  ]
};

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-100 tabular-nums">{value}</div>
      <div className="text-[11px] text-slate-500">{detail}</div>
    </div>
  );
}

export function EvaluationView() {
  const [datasetText, setDatasetText] = useState(JSON.stringify(starter, null, 2));
  const [datasetSaved, setDatasetSaved] = useState(false);
  const [datasetCount, setDatasetCount] = useState(0);
  const [inspectQuery, setInspectQuery] = useState("");
  const [chunks, setChunks] = useState<any[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [topK, setTopK] = useState(5);
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [error, setError] = useState("");

  const parsedDataset = useMemo(() => {
    try { return JSON.parse(datasetText); } catch { return null; }
  }, [datasetText]);

  useEffect(() => {
    fetch("/api/evaluation/dataset")
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data.cases) && data.cases.length > 0) {
          setDatasetText(JSON.stringify(data, null, 2));
          setDatasetCount(data.cases.length);
        }
      })
      .catch((err) => setError(err.message || "Could not load benchmark dataset."));
    fetch("/api/evaluation/latest")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setReport(data); })
      .catch(() => undefined);
  }, []);

  async function saveDataset() {
    setError("");
    setDatasetSaved(false);
    if (!parsedDataset || !Array.isArray(parsedDataset.cases)) {
      setError("Dataset JSON is invalid. It must contain a cases array.");
      return;
    }
    try {
      const res = await fetch("/api/evaluation/dataset", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedDataset)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Dataset save failed.");
      setDatasetCount(data.cases.length);
      setDatasetText(JSON.stringify(data, null, 2));
      setDatasetSaved(true);
    } catch (err: any) { setError(err.message || "Dataset save failed."); }
  }

  async function inspect() {
    if (!inspectQuery.trim()) return;
    setInspecting(true); setError("");
    try {
      const res = await fetch("/api/evaluation/inspect?query=" + encodeURIComponent(inspectQuery) + "&top_k=10");
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Inspection failed.");
      setChunks(data.chunks || []);
    } catch (err: any) { setError(err.message || "Inspection failed."); }
    finally { setInspecting(false); }
  }

  async function runBenchmark() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/evaluation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ top_k: topK, min_score: 0, provider: provider || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Evaluation failed.");
      setReport(data);
    } catch (err: any) { setError(err.message || "Evaluation failed."); }
    finally { setLoading(false); }
  }

  const metrics = report?.metrics || {};
  const fmt = (v: any, suffix = "") => typeof v === "number" ? (v * (suffix === "%" ? 100 : 1)).toFixed(2) + suffix : "—";

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-100 text-sm font-semibold"><FlaskConical className="w-4 h-4 text-cyan-400" /> RAG Evaluation Lab</div>
          <p className="mt-1 text-xs text-slate-400">Run a ground-truth benchmark against the live Python retrieval and generation pipeline.</p>
        </div>
        <button onClick={runBenchmark} disabled={loading || datasetCount === 0} className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40">
          <Play className="w-3.5 h-3.5" /> {loading ? "Running benchmark..." : "Run evaluation"}
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-900/70 bg-rose-950/30 p-3 text-xs text-rose-300 flex gap-2"><CircleAlert className="w-4 h-4 shrink-0" />{error}</div>}

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-xs font-semibold text-slate-100">1. Custom benchmark dataset</h2><p className="text-[11px] text-slate-500 mt-1">Annotate exact chunk IDs from the live backend. The example is a template, not a scored test.</p></div>
          <span className="text-[11px] text-slate-400">{datasetCount} saved cases</span>
        </div>
        <textarea value={datasetText} onChange={(e) => { setDatasetText(e.target.value); setDatasetSaved(false); }} rows={13} spellCheck={false} className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300 outline-none focus:border-cyan-500/50" />
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={saveDataset} disabled={!parsedDataset} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"><Save className="w-3.5 h-3.5" /> Save dataset</button>
          {datasetSaved && <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Saved</span>}
          <span className="text-[11px] text-slate-500">30–50 diverse cases recommended for a meaningful benchmark.</span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
        <div><h2 className="text-xs font-semibold text-slate-100">2. Find relevant chunk IDs</h2><p className="text-[11px] text-slate-500 mt-1">Search the real vector store, then copy IDs for all chunks that contain evidence for your question.</p></div>
        <div className="flex gap-2">
          <input value={inspectQuery} onChange={(e) => setInspectQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") inspect(); }} placeholder="Enter a benchmark question..." className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-cyan-500/50" />
          <button onClick={inspect} disabled={inspecting || !inspectQuery.trim()} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-40"><Search className="w-3.5 h-3.5" />{inspecting ? "Searching" : "Inspect"}</button>
        </div>
        {chunks.map((chunk) => (
          <div key={chunk.chunk_id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]"><span className="text-cyan-300 font-mono">#{chunk.rank} · {chunk.chunk_id}</span><span className="text-slate-500">{chunk.source} · score {chunk.similarity_score}</span><button onClick={() => navigator.clipboard.writeText(chunk.chunk_id)} className="text-cyan-400 hover:text-cyan-300">Copy ID</button></div>
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">{chunk.content}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <div><h2 className="text-xs font-semibold text-slate-100">3. Benchmark configuration</h2><p className="text-[11px] text-slate-500 mt-1">The same live backend is used for retrieval and answer generation.</p></div>
        <div className="flex flex-wrap items-center gap-5 text-xs">
          <label className="flex items-center gap-2 text-slate-400">Top-k <select value={topK} onChange={(e) => setTopK(Number(e.target.value))} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200">{[3,5,8,10,15,20].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="flex items-center gap-2 text-slate-400">Provider override <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"><option value="">Default provider</option><option value="gemini">Gemini</option><option value="groq">Groq</option></select></label>
        </div>
      </section>

      {report && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-100">Latest evaluation results</h2><p className="text-[11px] text-slate-500">{report.dataset_name} · {report.dataset_cases} cases · {report.provider}</p></div><span className="text-[11px] text-slate-500">Scores are benchmark outputs, not model confidence</span></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Recall@k" value={fmt(metrics.recall_at_k, "%")} detail="Requires relevant chunk IDs" />
          <MetricCard label="MRR" value={fmt(metrics.mrr)} detail="First relevant chunk rank" />
          <MetricCard label="Faithfulness" value={fmt(metrics.faithfulness, "%")} detail="LLM judge · grounded claims" />
          <MetricCard label="Answer relevance" value={fmt(metrics.answer_relevance, "%")} detail="LLM judge · query alignment" />
          <MetricCard label="Context precision" value={fmt(metrics.context_precision, "%")} detail="Mean relevance of retrieved chunks" />
          <MetricCard label="Context relevance" value={fmt(metrics.context_relevance, "%")} detail="LLM judge · passage usefulness" />
          <MetricCard label="Retrieval latency" value={metrics.latency_ms ? metrics.latency_ms.retrieval_avg + " ms" : "—"} detail="Average per query" />
          <MetricCard label="Generation latency" value={metrics.latency_ms ? metrics.latency_ms.generation_avg + " ms" : "—"} detail="Average per query" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricCard label="Total latency" value={metrics.latency_ms ? metrics.latency_ms.total_avg + " ms" : "—"} detail="Includes judge time" />
          <MetricCard label="Estimated tokens" value={metrics.token_usage ? (metrics.token_usage.input_tokens_estimated + metrics.token_usage.output_tokens_estimated).toLocaleString() : "—"} detail="Character-based estimate, not provider usage" />
          <MetricCard label="Estimated API cost" value={metrics.api_cost?.estimated_cost == null ? "Not configured" : metrics.api_cost.currency + " " + metrics.api_cost.estimated_cost} detail="Requires model-specific per-1K rates" />
        </div>
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-[11px] text-amber-200/80 flex gap-2"><Activity className="w-4 h-4 shrink-0" /> Ingestion latency is not part of query runs. Token usage is estimated until Gemini/Groq provider-reported usage metadata is wired in; API cost is shown only when rates are configured.</div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-200 flex items-center gap-2"><BookOpenCheck className="w-4 h-4 text-cyan-400" /> Per-question results</div>
          {report.cases?.map((item: any) => <div key={item.id} className="border-t border-slate-800 pt-3 space-y-2">
            <div className="text-xs text-slate-200">{item.query}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500"><span>Recall: {fmt(item.recall_at_k)}</span><span>MRR: {fmt(item.mrr)}</span><span>Faithfulness: {fmt(item.faithfulness)}</span><span>Relevance: {fmt(item.answer_relevance)}</span><span className="inline-flex items-center gap-1"><Timer className="w-3 h-3" />{item.latency_ms?.total} ms</span></div>
          </div>)}
        </div>
      </section>}
    </div>
  );
}
