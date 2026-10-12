import { NextRequest, NextResponse } from "next/server";
import { ragStore } from "@/lib/rag-store";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const customContent = formData.get("content") as string | null;
    const filename = (formData.get("filename") as string) || file?.name || "document.txt";

    let textContent = "";

    if (file) {
      const buffer = await file.arrayBuffer();
      // If it's a PDF or text file
      if (file.name.endsWith(".pdf")) {
        // Attempt basic text extraction from PDF stream
        const rawText = new TextDecoder("latin1").decode(buffer);
        // Extract plain text segments
        const matches = rawText.match(/\((.*?)\)\s*T[jJ]/g);
        if (matches && matches.length > 0) {
          textContent = matches
            .map((m) => m.replace(/^\(/, "").replace(/\)\s*T[jJ]$/, ""))
            .join(" ");
        } else {
          // Fallback to printable characters
          textContent = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
        }
      } else {
        textContent = new TextDecoder("utf-8").decode(buffer);
      }
    } else if (customContent) {
      textContent = customContent;
    }

    if (!textContent || textContent.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "No readable text content provided in upload." },
        { status: 400 }
      );
    }

    const ext = filename.split(".").pop()?.toLowerCase() || "txt";
    const doc = ragStore.addDocument(filename, filename, ext, textContent);

    return NextResponse.json({
      source: filename,
      chunks_created: doc.chunks_count,
      success: true,
      message: `Successfully ingested ${filename} (${doc.chunks_count} chunks created)`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Upload processing failed";
    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 500 }
    );
  }
}
