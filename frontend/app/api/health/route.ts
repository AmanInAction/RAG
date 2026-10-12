import { NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function GET() {
  const stats = ragStore.getStats();
  return NextResponse.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    vector_store: {
      backend: stats.backend,
      chunks: stats.total_chunks,
      documents: stats.total_documents,
    },
  });
}
