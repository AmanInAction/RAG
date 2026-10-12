"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  FileText,
  Copy,
  Check,
  Zap,
  Plus,
  MessageSquare,
  Layers,
  ArrowUpRight,
} from "lucide-react";

interface SourceCitation {
  source: string;
  page: number | string;
  score: number;
  initial_score?: number;
  preview: string;
  section?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceCitation[];
  confidence?: number;
  timestamp: string;
  isStreaming?: boolean;
}

interface SessionItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface ChatbotViewProps {
  activeProvider: string;
  onNavigateToKnowledge: () => void;
}

export function ChatbotView({
  activeProvider,
  onNavigateToKnowledge,
}: ChatbotViewProps) {
  // Multi-session state (Phase 4 / 4.1)
  const [sessions, setSessions] = useState<SessionItem[]>([
    {
      id: "session_default",
      title: "RAG Knowledge Inquiries",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 1,
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("session_default");
  const [sessionHistories, setSessionHistories] = useState<Record<string, Message[]>>({
    session_default: [
      {
        id: "welcome_msg",
        role: "assistant",
        content:
          "Hello! I am your RAG Knowledge Assistant. I answer questions grounded strictly in your indexed documents (PDF, text files, and catalogs) with live source citations and semantic similarity scores.\n\nAsk me anything about the indexed documents or select one of the suggested prompts below to get started.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ],
  });

  const messages = sessionHistories[activeSessionId] || [];

  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Parameter controls
  const [showConfig, setShowConfig] = useState(false);
  const [topK, setTopK] = useState(5);
  const [minScore, setMinScore] = useState(0.2);
  const [providerOverride, setProviderOverride] = useState<string>(activeProvider);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load sessions on mount
  useEffect(() => {
    let ignore = false;
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.sessions && data.sessions.length > 0) {
          setSessions(data.sessions);
        }
      })
      .catch((err) => console.warn("Failed to load sessions", err));
    return () => {
      ignore = true;
    };
  }, []);

  const handleCreateSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Inquiry ${sessions.length + 1}` }),
      });
      if (res.ok) {
        const data = await res.json();
        const newSession = data.session;
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setSessionHistories((prev) => ({
          ...prev,
          [newSession.id]: [
            {
              id: `welcome_${newSession.id}`,
              role: "assistant",
              content: `Started new session: **${newSession.title}**. What would you like to explore?`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ],
        }));
      }
    } catch (err) {
      console.warn("Failed to create session", err);
    }
  }, [sessions.length]);

  const samplePrompts = [
    "What are ChatGPT's core capabilities, strengths, and stated limitations?",
    "Which books in the catalog have ratings above 4.25 and when were they published?",
    "How does artificial intelligence support human creativity according to the sample files?",
    "What is the content and purpose of sample text file 1?",
  ];

  const handleSend = async (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text || isLoading) return;

    setInputQuery("");

    const userMsgId = `user_${Date.now()}`;
    const assistantMsgId = `assistant_${Date.now()}`;

    const currentMsgs = sessionHistories[activeSessionId] || [];
    const previousTurns = currentMsgs
      .filter((m) => m.content && !m.isStreaming)
      .slice(-4)
      .map((m) => ({ role: m.role, content: m.content }));

    const updatedMessages: Message[] = [
      ...currentMsgs,
      {
        id: userMsgId,
        role: "user",
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];

    setSessionHistories((prev) => ({ ...prev, [activeSessionId]: updatedMessages }));
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          top_k: topK,
          min_score: minScore,
          provider: providerOverride,
          history: previousTurns,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No readable response stream available");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let accumulatedAnswer = "";
      let retrievedSources: SourceCitation[] = [];
      let retrievedConfidence = 0.8;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const events = streamBuffer.split("\n\n");
        streamBuffer = events.pop() || "";

        for (const evtBlock of events) {
          if (!evtBlock.trim()) continue;

          const lines = evtBlock.split("\n");
          let eventType = "";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.slice(6).trim();
            }
          }

          if (eventType === "metadata" && dataStr) {
            try {
              const meta = JSON.parse(dataStr);
              retrievedSources = meta.sources || [];
              retrievedConfidence = meta.confidence || 0.8;
            } catch (err) {
              console.warn("Failed to parse metadata event", err);
            }
          } else if (eventType === "token" && dataStr) {
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.token) {
                accumulatedAnswer += parsed.token;
                setSessionHistories((prev) => {
                  const msgs = prev[activeSessionId] || [];
                  return {
                    ...prev,
                    [activeSessionId]: msgs.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            content: accumulatedAnswer,
                            sources: retrievedSources,
                            confidence: retrievedConfidence,
                            isStreaming: true,
                          }
                        : m
                    ),
                  };
                });
              }
            } catch (err) {
              console.warn("Failed to parse token event", err);
            }
          } else if (eventType === "done") {
            setSessionHistories((prev) => {
              const msgs = prev[activeSessionId] || [];
              return {
                ...prev,
                [activeSessionId]: msgs.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: accumulatedAnswer,
                        sources: retrievedSources,
                        confidence: retrievedConfidence,
                        isStreaming: false,
                      }
                    : m
                ),
              };
            });
          }
        }
      }

      setSessionHistories((prev) => {
        const msgs = prev[activeSessionId] || [];
        return {
          ...prev,
          [activeSessionId]: msgs.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m
          ),
        };
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Network error";
      setSessionHistories((prev) => {
        const msgs = prev[activeSessionId] || [];
        return {
          ...prev,
          [activeSessionId]: msgs.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: `An error occurred during retrieval: ${errMsg}. Please ensure your search parameters are valid.`,
                  isStreaming: false,
                }
              : m
          ),
        };
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSessionHistories((prev) => ({
      ...prev,
      [activeSessionId]: [
        {
          id: `welcome_${Date.now()}`,
          role: "assistant",
          content: "Conversation session cleared. What would you like to explore from the knowledge repository?",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ],
    }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSources = (msgId: string) => {
    setExpandedSources((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden">
      {/* Parameter Control & Session Bar */}
      <div className="px-6 py-2.5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-4">
          {/* Multi-Session Selector (Phase 4 / 4.1) */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={activeSessionId}
              onChange={(e) => setActiveSessionId(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                  {s.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreateSession}
              className="p-0.5 hover:text-cyan-300 transition-colors"
              title="New Session"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-slate-700 hidden sm:inline" aria-hidden="true">·</span>

          <div className="hidden sm:flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Model:</span>
            <span className="text-slate-200 font-medium capitalize">
              {providerOverride}
            </span>
          </div>
          <span className="text-slate-700 hidden sm:inline" aria-hidden="true">·</span>
          <div className="hidden sm:flex items-center gap-1.5">
            <span>Top-K:</span>
            <span className="text-slate-200 font-mono">{topK}</span>
          </div>
          <span className="text-slate-700 hidden sm:inline" aria-hidden="true">·</span>
          <div className="hidden sm:flex items-center gap-1.5">
            <span>Cutoff:</span>
            <span className="text-slate-200 font-mono">{(minScore * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
              showConfig
                ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Tune Parameters</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md text-xs transition-colors"
            title="Reset conversation"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Tuner Popdown Drawer */}
      {showConfig && (
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300 flex flex-wrap gap-6 items-center shrink-0 animate-in slide-in-from-top-2 duration-150">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              LLM Provider Override
            </label>
            <div className="flex gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setProviderOverride("gemini")}
                className={`px-3 py-1 rounded-md transition-colors ${
                  providerOverride === "gemini"
                    ? "bg-slate-800 text-cyan-300 font-medium"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Google Gemini
              </button>
              <button
                type="button"
                onClick={() => setProviderOverride("groq")}
                className={`px-3 py-1 rounded-md transition-colors ${
                  providerOverride === "groq"
                    ? "bg-slate-800 text-cyan-300 font-medium"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Groq (LLaMA)
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Top-K Chunks to Retrieve</span>
              <span className="font-mono text-cyan-400 font-semibold">{topK}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-36 accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Similarity Cutoff Threshold</span>
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
              className="w-36 accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Main Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const hasSources = msg.sources && msg.sources.length > 0;
          const isExpanded = !!expandedSources[msg.id];

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-3xl rounded-xl px-5 py-4 border transition-all ${
                  isUser
                    ? "bg-blue-600/15 border-blue-500/30 text-slate-100"
                    : "bg-slate-900/80 border-slate-800 text-slate-200 shadow-sm"
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-slate-800/60 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">
                      {isUser ? "You" : "RAG Assistant"}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono">{msg.timestamp}</span>
                  </div>

                  {!isUser && msg.confidence !== undefined && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-500">Confidence:</span>
                      <span
                        className={`font-mono font-medium ${
                          msg.confidence >= 0.75
                            ? "text-emerald-400"
                            : msg.confidence >= 0.5
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {(msg.confidence * 100).toFixed(1)}% (
                        {msg.confidence >= 0.75
                          ? "High"
                          : msg.confidence >= 0.5
                          ? "Medium"
                          : "Low"}
                        )
                      </span>
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-slate-200 font-normal">
                  {msg.content || (msg.isStreaming ? "Retrieving vector candidates and synthesizing answer..." : "")}
                </div>

                {/* Action Row for Assistant Messages */}
                {!isUser && msg.content && (
                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      {hasSources && (
                        <button
                          type="button"
                          onClick={() => toggleSources(msg.id)}
                          className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>
                            {msg.sources!.length} Source Citation
                            {msg.sources!.length > 1 ? "s" : ""}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="flex items-center gap-1 hover:text-slate-200 transition-colors"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Expandable Citations Card */}
                {!isUser && hasSources && isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5 animate-in fade-in-50 duration-150">
                    <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Grounding Evidence & Retrieved Chunks</span>
                      <span className="text-slate-500 font-normal capitalize">Two-Stage Cross-Encoder Reranked</span>
                    </div>
                    <div className="space-y-2">
                      {msg.sources!.map((citation, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-200 truncate">
                              {idx + 1}. {citation.source}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] shrink-0">
                              {citation.section && (
                                <span className="text-cyan-400 font-medium">[{citation.section}]</span>
                              )}
                              <span className="text-slate-500">Page {citation.page}</span>
                              <span className="text-slate-700" aria-hidden="true">·</span>
                              <span className="font-mono text-cyan-400 font-medium">
                                {(citation.score * 100).toFixed(1)}% match
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-3 bg-slate-900/40 p-2 rounded border border-slate-900 font-mono">
                            &ldquo;{citation.preview}&rdquo;
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts Strip */}
      {messages.length <= 3 && (
        <div className="px-6 py-2 bg-slate-950 border-t border-slate-900 shrink-0">
          <div className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Suggested Inquiries from Knowledge Base:</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {samplePrompts.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(prompt)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 text-left whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Composer Zone */}
      <div className="p-4 bg-slate-950 border-t border-slate-800/80 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-2 focus-within:border-cyan-500/50 transition-colors"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask a question against indexed documents (context preserved across turns)..."
            disabled={isLoading}
            className="flex-1 bg-transparent px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={isLoading || !inputQuery.trim()}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-2 px-1 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>Multi-turn conversational memory active for {sessions.find(s => s.id === activeSessionId)?.title || "current session"}.</span>
          </span>
          <button
            type="button"
            onClick={onNavigateToKnowledge}
            className="text-cyan-400 hover:underline flex items-center gap-0.5"
          >
            <span>Manage Documents</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
