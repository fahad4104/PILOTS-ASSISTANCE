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
  quote?: string;
};

function extractCitations(resp: any): Citation[] {
  const out: Citation[] = [];
  const output = Array.isArray(resp?.output) ? resp.output : [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      const anns = Array.isArray(part?.annotations) ? part.annotations : [];

      for (const a of anns) {
        if (a?.type !== "file_citation") continue;

        // الشكل الجديد غالباً:
        // a.file_citation = { file_id, quote, ... }
        const fc = a.file_citation ?? null;

        const file_id = fc?.file_id ?? a.file_id ?? undefined;
        const quote = fc?.quote ?? a.quote ?? undefined;

        // بعض الإصدارات تعطي index مباشرة أو داخل file_citation
        const index =
          typeof fc?.index === "number"
            ? fc.index
            : typeof a.index === "number"
            ? a.index
            : undefined;

        // filename أحياناً غير متوفر في الشكل الجديد
        const filename = a.filename ?? fc?.filename ?? undefined;

        const page = mapCitationToPage({ filename, index }) ?? undefined;

        out.push({
          type: "file_citation",
          filename,
          file_id,
          index,
          page,
          quote,
        });
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

    const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;
    if (!VECTOR_STORE_ID) {
      return NextResponse.json({ ok: false, error: "VECTOR_STORE_ID missing" }, { status: 500 });
    }

    const system = `
You are a STRICT aviation manuals retrieval system.

MANDATORY RULES:
- Answer ONLY using retrieved excerpts from the manuals via file_search.
- DO NOT use general knowledge. DO NOT guess.
- DO NOT summarize, generalize, or say "varies" or "generally".
- If the retrieved text is a table, output the values EXACTLY as a list.
- If you cannot find it in retrieved excerpts, reply exactly: "Not found in manuals."
- Always include at least one verbatim quote from the manual when answering.

OUTPUT FORMAT (STRICT, ALWAYS THE SAME):
Direct Answer:
<one-line answer WITHOUT ranges; say "See values below.">

Values:
- <Aircraft/Config>: <number>
- <Aircraft/Config>: <number>
- ...

Quote:
"<verbatim quote>"
`;


    const resp = await openai.responses.create({
      model: process.env.ASK_MODEL || "gpt-4o-mini",
      temperature: 0,
      top_p: 1,

      // ✅ اجبار استخدام البحث
      tool_choice: { type: "file_search" },

      input: [
        { role: "system", content: system },
        { role: "user", content: q },
      ],

      tools: [
        {
          type: "file_search",
          vector_store_ids: [VECTOR_STORE_ID],
          max_num_results: 10,
        },
      ],
    });

    const citations = extractCitations(resp);

    // إذا ما فيه citations، رجّع Not found (بأمان)
    if (!citations.length) {
      return NextResponse.json({
        ok: true,
        answer: lang === "ar" ? "غير موجود في الدليل." : "Not found in manuals.",
        citations: [],
      });
    }

    const answerText =
      typeof resp.output_text === "string" && resp.output_text.trim()
        ? resp.output_text.trim()
        : lang === "ar"
        ? "غير موجود في الدليل."
        : "Not found in manuals.";

    return NextResponse.json({
      ok: true,
      answer: answerText,
      citations,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Ask failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
