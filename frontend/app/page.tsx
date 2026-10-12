"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { ChatbotView } from "@/components/ChatbotView";
import { KnowledgeBaseView } from "@/components/KnowledgeBaseView";
import { PlaygroundView } from "@/components/PlaygroundView";
import { SettingsView } from "@/components/SettingsView";

export default function Home() {
  const [activeTab, setActiveTab] = useState("chat");
  const [activeProvider, setActiveProvider] = useState("gemini");
  const [activeBackend, setActiveBackend] = useState("faiss");

  const [totalChunks, setTotalChunks] = useState(0);
  const [totalDocs, setTotalDocs] = useState(0);
  const [backendStatus, setBackendStatus] = useState("online");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/vector-store/stats");
      if (res.ok) {
        const data = await res.json();
        setTotalChunks(data.total_chunks || 0);
        setTotalDocs(data.total_documents || 0);
        setActiveBackend(data.backend || "faiss");
        setBackendStatus("online");
      }
    } catch {
      setBackendStatus("degraded");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch("/api/vector-store/stats")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          setTotalChunks(data.total_chunks || 0);
          setTotalDocs(data.total_documents || 0);
          setActiveBackend(data.backend || "faiss");
          setBackendStatus("online");
        }
      })
      .catch(() => {
        if (!ignore) setBackendStatus("degraded");
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Left Workspace Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeProvider={activeProvider}
        activeBackend={activeBackend}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Contract */}
        <Navbar
          activeTab={activeTab}
          backendStatus={backendStatus}
          totalChunks={totalChunks}
          totalDocs={totalDocs}
          onRefreshStats={fetchStats}
          isRefreshing={isRefreshing}
        />

        {/* Dynamic View Tab */}
        <main className="flex-1 flex overflow-hidden">
          {activeTab === "chat" && (
            <ChatbotView
              activeProvider={activeProvider}
              onNavigateToKnowledge={() => setActiveTab("knowledge")}
            />
          )}

          {activeTab === "knowledge" && (
            <KnowledgeBaseView onDocumentCountChange={fetchStats} />
          )}

          {activeTab === "playground" && <PlaygroundView />}

          {activeTab === "settings" && (
            <SettingsView
              activeProvider={activeProvider}
              setActiveProvider={setActiveProvider}
              activeBackend={activeBackend}
              setActiveBackend={setActiveBackend}
              onStoreCleared={fetchStats}
            />
          )}
        </main>
      </div>
    </div>
  );
}
