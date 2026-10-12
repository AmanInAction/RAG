import { NextRequest } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, top_k = 5, min_score = 0.2, provider, history } = body;

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ragResult = await ragStore.queryRAG(
      query,
      Number(top_k),
      Number(min_score),
      provider,
      history
    );

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // 1. Send metadata event immediately
        const metadata = {
          sources: ragResult.sources,
          confidence: ragResult.confidence,
          context: ragResult.context,
        };
        controller.enqueue(
          encoder.encode(`event: metadata\ndata: ${JSON.stringify(metadata)}\n\n`)
        );

        // 2. Stream tokens in small chunks with realistic natural pacing
        const words = ragResult.answer.split(/(\s+)/);
        for (let i = 0; i < words.length; i++) {
          const token = words[i];
          controller.enqueue(
            encoder.encode(
              `event: token\ndata: ${JSON.stringify({ token })}\n\n`
            )
          );
          // Micro delay between word groups for streaming rhythm
          if (i % 3 === 0) {
            await new Promise((r) => setTimeout(r, 12));
          }
        }

        // 3. Send done event
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Streaming failed";
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
