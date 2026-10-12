import { NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function GET() {
  const documents = ragStore.listDocuments();
  const stats = ragStore.getStats();

  return NextResponse.json({
    total_documents: documents.length,
    total_chunks: stats.total_chunks,
    documents,
  });
}
