import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const question = String(body?.question ?? "").trim();
    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    const vectorStoreId = (process.env.VECTOR_STORE_ID || "").trim();
    if (!vectorStoreId) {
      return NextResponse.json(
        { error: "VECTOR_STORE_ID missing" },
        { status: 500 }
      );
    }

    const openai = getOpenAI();

    const resp = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `Answer using ONLY the provided manuals via file_search. If not found, say "Not found in manuals.".\n\nUser question: ${question}`,
      tools: [
        {
          type: "file_search",
          vector_store_ids: [vectorStoreId],
        } as any,
      ],
    } as any);

    const answer = (resp as any).output_text ?? "";

    // citations (إن وجدت)
    const citations: Array<{ file_id?: string; quote?: string }> = [];
    const output = (resp as any).output ?? [];
    for (const item of output) {
      const contentArr = item?.content ?? [];
      for (const c of contentArr) {
        const anns = c?.annotations ?? [];
        for (const a of anns) citations.push(a);
      }
    }

    return NextResponse.json({
      ok: true,
      answer: answer || "Not found in manuals.",
      citations,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Ask failed", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
