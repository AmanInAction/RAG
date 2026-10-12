import { NextRequest, NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { urls } = body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { success: false, message: "Array of URLs is required." },
        { status: 400 }
      );
    }

    const results: { url: string; status: "success" | "error"; chunks?: number; error?: string }[] = [];

    for (const rawUrl of urls.slice(0, 10)) {
      try {
        const parsed = new URL(rawUrl.trim());
        const res = await fetch(parsed.toString(), {
          headers: { "User-Agent": "RAG-Bot/1.0" },
          signal: AbortSignal.timeout(4000),
        });

        const html = await res.text();
        const extractedText = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (extractedText.length < 20) {
          results.push({ url: rawUrl, status: "error", error: "Insufficient text content" });
          continue;
        }

        const sourceName = `${parsed.hostname}${parsed.pathname}`;
        const doc = ragStore.addDocument(rawUrl, sourceName, "web", extractedText);
        results.push({ url: rawUrl, status: "success", chunks: doc.chunks_count });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Scrape failed";
        results.push({ url: rawUrl, status: "error", error: msg });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;

    return NextResponse.json({
      success: true,
      processed: results.length,
      successful: successCount,
      failed: results.length - successCount,
      results,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Batch processing failed";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
