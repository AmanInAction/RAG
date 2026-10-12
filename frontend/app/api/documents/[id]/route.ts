import { NextRequest, NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const decodedId = decodeURIComponent(id);
    const deletedCount = ragStore.deleteDocument(decodedId);

    return NextResponse.json({
      source: decodedId,
      deleted_chunks: deletedCount,
      success: true,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Deletion failed";
    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 500 }
    );
  }
}
