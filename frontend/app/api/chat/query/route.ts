import { NextRequest, NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, top_k = 5, min_score = 0.2, provider, history } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query string is required" },
        { status: 400 }
      );
    }

    const result = await ragStore.queryRAG(
      query,
      Number(top_k),
      Number(min_score),
      provider,
      history
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Chat query failed";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
