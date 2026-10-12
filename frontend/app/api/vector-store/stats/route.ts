import { NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function GET() {
  const stats = ragStore.getStats();
  return NextResponse.json(stats);
}
