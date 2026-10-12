"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  Globe,
  Trash2,
  FileText,
  Search,
  CheckCircle,
  AlertCircle,
  RotateCw,
  ExternalLink,
  Eye,
  X,
  Layers,
} from "lucide-react";

interface DocumentItem {
  source: string;
  source_name: string;
  chunks_count: number;
  format: string;
  sample_content: string;
  added_at?: string;
  file_size?: number;
}

interface KnowledgeBaseViewProps {
  onDocumentCountChange?: () => void;
}

export function KnowledgeBaseView({
  onDocumentCountChange,
}: KnowledgeBaseViewProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");

  // URL ingestion state
  const [urlMode, setUrlMode] = useState<"single" | "batch">("single");
  const [urlInput, setUrlInput] = useState("");
  const [batchUrlsInput, setBatchUrlsInput] = useState("");
  const [isUrlIngesting, setIsUrlIngesting] = useState(false);
  const [urlStatusMsg, setUrlStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Document chunk inspection modal
  const [inspectDoc, setInspectDoc] = useState<DocumentItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        setTotalChunks(data.total_chunks || 0);
        onDocumentCountChange?.();
      }
    } catch (err) {
      console.warn("Failed to fetch documents", err);
    } finally {
      setIsLoading(false);
    }
  }, [onDocumentCountChange]);

  useEffect(() => {
    let ignore = false;
    fetch("/api/documents")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          setDocuments(data.documents || []);
          setTotalChunks(data.total_chunks || 0);
          setIsLoading(false);
          onDocumentCountChange?.();
        }
      })
      .catch(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [onDocumentCountChange]);

  const handleUrlIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || isUrlIngesting) return;

    setIsUrlIngesting(true);
    setUrlStatusMsg(null);

    try {
      const res = await fetch("/api/documents/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUrlStatusMsg({
          type: "success",
          text: data.message || "URL ingested and indexed successfully.",
        });
        setUrlInput("");
        fetchDocuments();
      } else {
        setUrlStatusMsg({
          type: "error",
          text: data.message || "Failed to parse and ingest URL.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setUrlStatusMsg({ type: "error", text: msg });
    } finally {
      setIsUrlIngesting(false);
    }
  };

  const handleBatchUrlIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = batchUrlsInput
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http://") || u.startsWith("https://"));

    if (urls.length === 0 || isUrlIngesting) return;

    setIsUrlIngesting(true);
    setUrlStatusMsg(null);

    try {
      const res = await fetch("/api/documents/batch-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUrlStatusMsg({
          type: "success",
          text: `Batch ingested ${data.successful} of ${data.processed} URL(s) successfully.`,
        });
        setBatchUrlsInput("");
        fetchDocuments();
      } else {
        setUrlStatusMsg({
          type: "error",
          text: data.message || "Failed to batch ingest URLs.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Batch ingestion error";
      setUrlStatusMsg({ type: "error", text: msg });
    } finally {
      setIsUrlIngesting(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadStatusMsg(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("filename", file.name);

        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || `Failed to upload ${file.name}`);
        }
      }

      setUploadStatusMsg({
        type: "success",
        text: `Successfully processed and ingested ${files.length} document(s).`,
      });
      fetchDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadStatusMsg({ type: "error", text: msg });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (!confirm(`Are you sure you want to prune and delete "${sourceId}" and all its indexed chunks?`)) {
      return;
    }

    try {
      const encoded = encodeURIComponent(sourceId);
      const res = await fetch(`/api/documents/${encoded}`, { method: "DELETE" });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (err) {
      console.warn("Delete failed", err);
    }
  };

  const handleReindex = async () => {
    try {
      const res = await fetch("/api/documents/reindex", { method: "POST" });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (err) {
      console.warn("Reindex failed", err);
    }
  };

  const filteredDocs = documents.filter(
    (doc) =>
      doc.source.toLowerCase().includes(searchFilter.toLowerCase()) ||
      doc.source_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      doc.format.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-950 space-y-6">
      {/* Top Action & Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: File Upload Zone */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>Upload Document Files</span>
              </h2>
              <span className="text-[11px] text-slate-400">PDF, TXT, MD, JSON</span>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Files are split into configurable overlapping chunks and encoded with 384-dimensional dense vectors.
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging
                  ? "border-cyan-400 bg-cyan-950/20"
                  : "border-slate-800 hover:border-slate-700 bg-slate-950/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,.json,.jsonl"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              <Upload className={`w-8 h-8 mx-auto mb-2 ${isUploading ? "animate-bounce text-cyan-400" : "text-slate-500"}`} />
              <div className="text-xs text-slate-300 font-medium">
                {isUploading ? (
                  <span className="text-cyan-400">Processing and indexing document chunks...</span>
                ) : (
                  <>
                    Drag and drop files here, or{" "}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-cyan-400 hover:underline font-semibold"
                    >
                      browse computer
                    </button>
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Supports batch uploading with automatic document deduplication
              </p>
            </div>
          </div>

          {uploadStatusMsg && (
            <div
              className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                uploadStatusMsg.type === "success"
                  ? "bg-emerald-950/40 text-emerald-300 border border-emerald-900"
                  : "bg-rose-950/40 text-rose-300 border border-rose-900"
              }`}
            >
              {uploadStatusMsg.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{uploadStatusMsg.text}</span>
            </div>
          )}
        </div>

        {/* Card 2: URL Ingestion Input */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Web Ingestion & Crawling</span>
              </h2>
              {/* Mode Toggle Buttons */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setUrlMode("single")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    urlMode === "single" ? "bg-slate-800 text-cyan-400 font-medium" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Single URL
                </button>
                <button
                  type="button"
                  onClick={() => setUrlMode("batch")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    urlMode === "batch" ? "bg-slate-800 text-cyan-400 font-medium" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Batch Multi-Page
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              {urlMode === "single"
                ? "Dynamically fetches target website HTML, strips boilerplate tags, and indexes content vectors."
                : "Batch ingest multiple URLs simultaneously with 4-second timeout protection and individual status tracking."}
            </p>

            {urlMode === "single" ? (
              <form onSubmit={handleUrlIngest} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Public Web URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://en.wikipedia.org/wiki/Retrieval-augmented_generation"
                      disabled={isUrlIngesting}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={isUrlIngesting || !urlInput.trim()}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5"
                    >
                      {isUrlIngesting ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Scraping...</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Ingest</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleBatchUrlIngest} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Target URLs (One per line, up to 10)
                  </label>
                  <textarea
                    rows={3}
                    value={batchUrlsInput}
                    onChange={(e) => setBatchUrlsInput(e.target.value)}
                    placeholder={"https://example.com/docs/intro\nhttps://example.com/docs/api\nhttps://example.com/docs/guides"}
                    disabled={isUrlIngesting}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder:text-slate-500 font-mono focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                  />
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="submit"
                      disabled={isUrlIngesting || !batchUrlsInput.trim()}
                      className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isUrlIngesting ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Ingesting Batch...</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Ingest All URLs</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {urlStatusMsg && (
            <div
              className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                urlStatusMsg.type === "success"
                  ? "bg-emerald-950/40 text-emerald-300 border border-emerald-900"
                  : "bg-rose-950/40 text-rose-300 border border-rose-900"
              }`}
            >
              {urlStatusMsg.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{urlStatusMsg.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Document Inventory Table */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>Indexed Document Repository</span>
              <span className="text-slate-700" aria-hidden="true">·</span>
              <span className="text-xs text-slate-400 tabular-nums">
                {documents.length} document{documents.length !== 1 ? "s" : ""} ({totalChunks} total chunks)
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter documents..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <button
              onClick={handleReindex}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 transition-colors shrink-0"
              title="Reload pre-seeded documents"
            >
              <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto border border-slate-800/80 rounded-lg bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-medium border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Document / Source Name</th>
                <th className="py-3 px-4">Format</th>
                <th className="py-3 px-4 text-right">Indexed Chunks</th>
                <th className="py-3 px-4">Sample Preview</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Loading knowledge base catalog...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No documents found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr
                    key={doc.source}
                    className="hover:bg-slate-900/40 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                        <span className="font-medium text-slate-200 truncate max-w-xs">
                          {doc.source_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {/* Zero-Pill Unboxed Text */}
                      <span className="font-mono text-[11px] text-slate-400 uppercase">
                        {doc.format}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-cyan-400 font-medium">
                      {doc.chunks_count}
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="truncate text-slate-400 font-mono text-[11px]">
                        {doc.sample_content}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setInspectDoc(doc)}
                          className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors"
                          title="Inspect chunks"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.source)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                          title="Delete document and vector chunks"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Chunks Inspector Modal */}
      {inspectDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Document Chunks: {inspectDoc.source_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-3 text-xs text-slate-400 flex items-center gap-3">
              <span>Format: <span className="font-mono text-slate-200 uppercase">{inspectDoc.format}</span></span>
              <span>·</span>
              <span>Total Chunks: <span className="font-mono text-cyan-400 font-semibold">{inspectDoc.chunks_count}</span></span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                {inspectDoc.sample_content}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectDoc(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
