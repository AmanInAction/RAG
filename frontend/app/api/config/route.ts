import { NextRequest, NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function GET() {
  const config = ragStore.getConfig();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  try {
    const updates = await req.json();
    const updated = ragStore.updateConfig(updates);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Config update failed";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
