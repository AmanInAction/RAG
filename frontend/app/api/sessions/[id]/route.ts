import { NextRequest, NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = ragStore.getSession(decodeURIComponent(id));
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json({ session });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const updated = ragStore.updateSessionMessages(
      decodeURIComponent(id),
      body.messages || [],
      body.title
    );
    if (!updated) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ session: updated, success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const deleted = ragStore.deleteSession(decodeURIComponent(id));
  return NextResponse.json({ success: deleted });
}
