import { NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function POST() {
  try {
    ragStore.reindexAll();
    const stats = ragStore.getStats();

    return NextResponse.json({
      success: true,
      message: "Knowledge base reindexed successfully.",
      stats,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Reindexing failed";
    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 500 }
    );
  }
}
