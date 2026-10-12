import { NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function DELETE() {
  try {
    ragStore.clearStore();
    return NextResponse.json({
      success: true,
      message: "Vector store cleared successfully.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Clear failed";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
