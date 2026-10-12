import { NextRequest, NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function GET() {
  const sessions = ragStore.listSessions();
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const session = ragStore.createSession(body.title);
    return NextResponse.json({ session, success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Session creation failed";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
