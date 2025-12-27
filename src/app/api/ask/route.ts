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

// ===== NEW: References formatting + answer normalization (no UI change) =====

function formatRefLine(c: Citation) {
  const name = c.filename || c.file_id || "unknown";
  const loc =
    typeof c.page === "number"
      ? `page ${c.page}`
      : typeof c.index === "number"
      ? `index ${c.index}`
      : "index ?";
  return `- ${name} • ${loc}`;
}

function buildReferencesBlock(citations: Citation[]) {
  const lines = citations.map(formatRefLine);
  return `References:\n${lines.join("\n")}`;
}

/**
 * Ensure the final answer is:
 * Direct Answer + Quote (from model) + References (from citations)
 * Also removes any References the model might have generated.
 */
function normalizeAnswer(answerText: string, citations: Citation[]) {
  const cleaned = String(answerText || "").trim();

  // Remove any model-written References section if present
  // (We keep everything before "References:" / "Reference:" / "REFERENCES:")
  const parts = cleaned.split(/\n\s*(References|Reference)\s*:\s*\n/i);
  const base = parts[0].trim();

  const refs = buildReferencesBlock(citations);

  return `${base}\n\n${refs}`.trim();
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

MANDATORY RULES (UPDATED):
- Answer ONLY using retrieved excerpts from the manuals via file_search.
- DO NOT use general knowledge. DO NOT guess.
- DO NOT summarize, generalize, or say "varies" or "generally".
- If you cannot find it in retrieved excerpts, reply exactly: "Not found in manuals."
- Always include at least one verbatim quote from the manual when answering.
- CRITICAL: Output ONE canonical value only. NEVER output multiple competing values.
- use kilograms (kg) instead of pounds (lbs) for weights.

CANONICAL SELECTION RULE (when multiple values exist in the retrieved excerpts):
1) Prefer FCOM over AFM/other docs.
2) Prefer the exact aircraft variant/config match if present.
3) If still multiple, choose the most conservative (lowest) value.
4) Do NOT list other values unless the user explicitly asks "show alternatives".


OUTPUT FORMAT (STRICT, ALWAYS THE SAME):
Direct Answer:
<ONE line, ONE value only. If applicable include aircraft/variant/config in the same line.>

Quote:
"<ONE verbatim quote that supports the chosen value>"

DO NOT include a References section. The system will add references automatically.
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
          // تقليل النتائج يقلل التضارب ويحسن الثبات
          max_num_results: 6,
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

    // (اختياري) تأكيد إضافي أن file_search أعطى نتائج
    // لا نكسر إذا citations موجودة لأن citations نفسها إثبات كافي
    const toolOk = fileSearchHadResults(resp);
    if (toolOk === false) {
      // intentionally no override: citations are sufficient proof of retrieval
    }

    const answerTextRaw =
      typeof resp.output_text === "string" && resp.output_text.trim()
        ? resp.output_text.trim()
        : lang === "ar"
        ? "غير موجود في الدليل."
        : "Not found in manuals.";

    // Enforce final canonical format: add ALL references from citations (no UI change)
    const answerTextFinal = normalizeAnswer(answerTextRaw, citations);

    return NextResponse.json({
      ok: true,
      answer: answerTextFinal,
      citations,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Ask failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
