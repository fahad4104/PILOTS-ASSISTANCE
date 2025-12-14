import { NextResponse } from "next/server";
import OpenAI from "openai";
import { mapCitationToPage } from "@/lib/pageMap";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Citation = {
  type: "file_citation";
  filename?: string;
  file_id?: string;
  index?: number;
  page?: number;
};

function extractCitations(resp: any): Citation[] {
  const out: Citation[] = [];
  const output = Array.isArray(resp?.output) ? resp.output : [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      const anns = Array.isArray(c?.annotations) ? c.annotations : [];
      for (const a of anns) {
        if (a.type === "file_citation") {
          const filename = a.filename;
          const file_id = a.file_id;
          const index = typeof a.index === "number" ? a.index : undefined;
          const page = mapCitationToPage({ filename, index }) ?? undefined;

          out.push({
            type: "file_citation",
            filename,
            file_id,
            index,
            page,
          });
        }
      }
    }
  }

  return out;
}

export async function POST(req: Request) {
  try {
    const { question, lang } = await req.json();
    const q = String(question || "").trim();

    if (!q) {
      return NextResponse.json({ ok: false, error: "Missing question" }, { status: 400 });
    }

    const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID!;
    if (!VECTOR_STORE_ID) {
      return NextResponse.json({ ok: false, error: "VECTOR_STORE_ID missing" }, { status: 500 });
    }

    const system =
      lang === "ar"
        ? "أجب فقط من الدليل. إذا لم تجد النص بشكل صريح قل: غير موجود في الدليل. لا تخمّن."
        : "Answer only using the manual. If not explicitly found, say: Not found in manuals. Do not guess.";

    const resp = await openai.responses.create({
      model: process.env.ASK_MODEL || "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: q },
      ],
      tools: [
        {
          type: "file_search",
          vector_store_ids: [VECTOR_STORE_ID],
        },
      ],
    });

    const answer =
      typeof resp.output_text === "string" && resp.output_text.trim()
        ? resp.output_text.trim()
        : lang === "ar"
        ? "غير موجود في الدليل."
        : "Not found in manuals.";

    const citations = extractCitations(resp);

    return NextResponse.json({
      ok: true,
      answer,
      citations,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Ask failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
