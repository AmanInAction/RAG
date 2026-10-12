import { NextRequest, NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, message: "Valid URL parameter is required." },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid URL format." },
        { status: 400 }
      );
    }

    let extractedText = "";
    try {
      const res = await fetch(parsedUrl.toString(), {
        headers: { "User-Agent": "RAG-Bot/1.0" },
        signal: AbortSignal.timeout(4000),
      });
      const html = await res.text();
      // Strip tags and scripts
      extractedText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed";
      return NextResponse.json(
        { success: false, message: `Could not fetch URL: ${msg}` },
        { status: 502 }
      );
    }

    if (!extractedText || extractedText.length < 20) {
      return NextResponse.json(
        { success: false, message: "No sufficient text content could be scraped from URL." },
        { status: 422 }
      );
    }

    const sourceName = `${parsedUrl.hostname}${parsedUrl.pathname}`;
    const doc = ragStore.addDocument(url, sourceName, "web", extractedText);

    return NextResponse.json({
      source: url,
      chunks_created: doc.chunks_count,
      success: true,
      message: `Successfully ingested web page ${sourceName} (${doc.chunks_count} chunks)`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "URL ingestion failed";
    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 500 }
    );
  }
}
