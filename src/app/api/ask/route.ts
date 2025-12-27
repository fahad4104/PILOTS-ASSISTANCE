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

function safeJsonParse<T = any>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Extract citations from multiple possible shapes of Responses API output.
 * This is intentionally defensive because the response schema can vary slightly.
 */
function extractCitations(resp: any): Citation[] {
  const out: Citation[] = [];
  const output = Array.isArray(resp?.output) ? resp.output : [];

  for (const item of output) {
    // message item usually has content[]
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const part of content) {
      // Typical shape:
      // part = { type: "output_text", text: "...", annotations: [...] }
      const anns = Array.isArray(part?.annotations) ? part.annotations : [];

      for (const a of anns) {
        if (a?.type !== "file_citation") continue;

        // Newer shapes:
        // a.file_citation = { file_id, quote, index?, filename? }
        const fc = a.file_citation ?? null;

        const file_id = fc?.file_id ?? a.file_id ?? undefined;
        const quote = fc?.quote ?? a.quote ?? undefined;

        const index =
          typeof fc?.index === "number"
            ? fc.index
            : typeof a.index === "number"
            ? a.index
            : undefined;

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

    // Some variants put annotations inside item directly (rare, but seen in some outputs)
    const itemAnns = Array.isArray(item?.annotations) ? item.annotations : [];
    for (const a of itemAnns) {
      if (a?.type !== "file_citation") continue;
      const fc = a.file_citation ?? null;

      const file_id = fc?.file_id ?? a.file_id ?? undefined;
      const quote = fc?.quote ?? a.quote ?? undefined;
      const index =
        typeof fc?.index === "number"
          ? fc.index
          : typeof a.index === "number"
          ? a.index
          : undefined;
      const filename = a.filename ?? fc?.filename ?? undefined;

      const page = mapCitationToPage({ filename, index }) ?? undefined;

      out.push({ type: "file_citation", filename, file_id, index, page, quote });
    }
  }

  // Deduplicate (same file_id + index + quote)
  const seen = new Set<string>();
  const deduped: Citation[] = [];
  for (const c of out) {
    const k = `${c.file_id ?? ""}::${c.index ?? ""}::${(c.quote ?? "").slice(0, 80)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(c);
  }

  return deduped;
}

/**
 * Verify that file_search tool was executed and returned some results.
 * The shape can vary; we check several likely locations.
 */
function fileSearchHadResults(resp: any): boolean {
  const output = Array.isArray(resp?.output) ? resp.output : [];

  for (const item of output) {
    // In many responses, tool calls appear as output items
    // e.g. { type: "tool_call", tool_name: "file_search", results: [...] }
    const toolName = item?.tool_name ?? item?.name ?? item?.tool?.name;
    const type = item?.type;

    if (type === "tool_call" && toolName === "file_search") {
      const results =
        item?.results ??
        item?.output ??
        item?.result ??
        item?.file_search?.results ??
        item?.file_search?.data;

      if (Array.isArray(results) && results.length > 0) return true;

      // Sometimes results are nested differently
      const r2 = item?.file_search?.results;
      if (Array.isArray(r2) && r2.length > 0) return true;

      // Tool ran but returned no results
      return false;
    }
  }

  // If we couldn't find explicit tool_call, fall back to citations presence check
  // (citations are effectively proof retrieval happened)
  return false;
}

export async function POST(req: Request) {
  try {
    const { question, lang } = await req.json();
    const q = String(question || "").trim();

    if (!q) {
      return NextResponse.json({ ok: false, error: "Missing question" }, { status: 400 });
    }

    const VECTOR_STORE_ID = (process.env.VECTOR_STORE_ID || "").trim();
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

      // اجبار استخدام file_search
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

    // قفل صارم: بدون citations = Not found (حتى لو الموديل كتب كلام)
    if (!citations.length) {
      return NextResponse.json({
        ok: true,
        answer: lang === "ar" ? "غير موجود في الدليل." : "Not found in manuals.",
        citations: [],
      });
    }

    // (اختياري لكنه مفيد): تأكيد إضافي أن file_search أعطى نتائج
    // لو ما قدرنا نثبت tool_call، ما نكسر لأن citations نفسها إثبات كافي
    // لكن لو tool_call موجود ورجّع 0 نتائج، نرجّع Not found
    const toolOk = fileSearchHadResults(resp);
    if (toolOk === false) {
      // لا نعمل override إذا citations موجودة (لأنها دليل قوي)
      // ولكن إذا تبغاه أقسى: فعّل هذا الشرط فقط عندما تكتشف tool_call صراحة
      // هنا نتركه كما هو لأن citations موجودة.
    }

    const answerText =
      typeof resp.output_text === "string" && resp.output_text.trim()
        ? resp.output_text.trim()
        : lang === "ar"
        ? "غير موجود في الدليل."
        : "Not found in manuals.";

    // Safety: لو output_text رجّع "Not found" لكن citations موجودة (نادر)
    // نخليه كما هو لأن النظام طلب صيغة ثابتة.

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
