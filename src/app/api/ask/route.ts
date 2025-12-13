import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";

type Citation = { filename?: string; quote?: string; file_id?: string };

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const question = String(body?.question ?? "").trim();

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    const vectorStoreId = process.env.VECTOR_STORE_ID;
    if (!vectorStoreId) {
      return NextResponse.json({ error: "VECTOR_STORE_ID missing" }, { status: 500 });
    }

    const resp = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `Answer using ONLY the provided manuals via file_search. If not found, say "Not found in manuals". Always include citations.\n\nQuestion: ${question}`,
      tools: [
        {
          type: "file_search",
          vector_store_ids: [vectorStoreId],
        } as any,
      ],
    } as any);

    const answer: string = (resp as any).output_text ?? "";

    const citations: Citation[] = [];
    const output = (resp as any).output ?? [];

    for (const item of output) {
      if (item.type !== "message") continue;
      const content = item.content ?? [];
      for (const c of content) {
        if (c.type !== "output_text") continue;
        const anns = c.annotations ?? [];
        for (const a of anns) {
          if (a.type === "file_citation") {
            citations.push({
              filename: a.filename,
              file_id: a.file_id,
              quote: a.quote,
            });
          }
        }
      }
    }

    return NextResponse.json({ ok: true, answer, citations });
  } catch (err: any) {
    console.error("ASK_ERROR:", err);

    const details =
      err?.error?.message ||
      err?.message ||
      "Unknown error";

    return NextResponse.json(
      {
        error: "Ask failed",
        details,
        raw: err,
      },
      { status: 500 }
    );
  }
}
