"use client";

import React from "react";
import { MessageSquare, FolderGit2, SearchCode, Sliders, Cpu } from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeProvider: string;
  activeBackend: string;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  activeProvider,
  activeBackend,
}: SidebarProps) {
  const navItems = [
    {
      id: "chat",
      label: "RAG Chatbot",
      icon: MessageSquare,
      description: "Streaming Q&A & Citations",
    },
    {
      id: "knowledge",
      label: "Knowledge Base",
      icon: FolderGit2,
      description: "Documents, PDF & URLs",
    },
    {
      id: "playground",
      label: "RAG Inspector",
      icon: SearchCode,
      description: "Similarity & Chunker Sandbox",
    },
    {
      id: "settings",
      label: "System Settings",
      icon: Sliders,
      description: "Store & Model Controls",
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between shrink-0">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-sm shadow-cyan-950">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-slate-100">
              RAG SaaS Engine
            </div>
            <div className="text-[11px] text-slate-400">
              Vector Retrieval Platform
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? "bg-slate-900 text-cyan-400 font-medium border border-slate-800/80 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-cyan-400" : "text-slate-500"
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs truncate">{item.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info Box */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
        <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
          <span>Active Configuration</span>
          <span className="font-mono text-cyan-400 uppercase text-[10px]">{activeBackend}</span>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] space-y-1 text-slate-300">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Provider</span>
            <span className="font-medium text-slate-200 capitalize">{activeProvider}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Embeddings</span>
            <span className="font-mono text-[10px] text-slate-300">MiniLM-L6 (384d)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Strategy</span>
            <span className="text-slate-300">Recursive Text</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
