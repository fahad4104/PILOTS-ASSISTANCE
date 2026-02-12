import { NextResponse } from "next/server";
import OpenAI from "openai";

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

type HistoryMessage = {
  role?: unknown;
  content?: unknown;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function sanitizeHistory(history: unknown): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(history)) return [];

  return history
    .map((item) => item as HistoryMessage)
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role as "user" | "assistant",
      content: String(item.content ?? "").trim(),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-8);
}

/**
 * Extract citations from multiple possible shapes of Responses API output.
 */
function extractCitations(resp: unknown): Citation[] {
  const out: Citation[] = [];
  const output = asArray(asObject(resp).output);

  for (const item of output) {
    const itemObj = asObject(item);
    const content = asArray(itemObj.content);

    for (const part of content) {
      const partObj = asObject(part);
      const anns = asArray(partObj.annotations);

      for (const annotation of anns) {
        const annotationObj = asObject(annotation);
        if (annotationObj.type !== "file_citation") continue;

        const fileCitation = asObject(annotationObj.file_citation);
        const file_id = asString(fileCitation.file_id) ?? asString(annotationObj.file_id);
        const quote = asString(fileCitation.quote) ?? asString(annotationObj.quote);

        const index = asNumber(fileCitation.index) ?? asNumber(annotationObj.index);

        const filename = asString(annotationObj.filename) ?? asString(fileCitation.filename);

        // Don't calculate approximate page - it's misleading due to blank pages/images
        const page = undefined;

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

    const itemAnns = asArray(itemObj.annotations);
    for (const annotation of itemAnns) {
      const annotationObj = asObject(annotation);
      if (annotationObj.type !== "file_citation") continue;
      const fileCitation = asObject(annotationObj.file_citation);

      const file_id = asString(fileCitation.file_id) ?? asString(annotationObj.file_id);
      const quote = asString(fileCitation.quote) ?? asString(annotationObj.quote);
      const index = asNumber(fileCitation.index) ?? asNumber(annotationObj.index);
      const filename = asString(annotationObj.filename) ?? asString(fileCitation.filename);

      const page = undefined;

      out.push({ type: "file_citation", filename, file_id, index, page, quote });
    }
  }

  // Deduplicate more aggressively - same filename only once
  const seen = new Set<string>();
  const deduped: Citation[] = [];
  for (const c of out) {
    const filename = c.filename || c.file_id || "unknown";
    if (seen.has(filename)) continue;
    seen.add(filename);
    deduped.push(c);
  }

  return deduped;
}

function fileSearchHadResults(resp: unknown): boolean {
  const output = asArray(asObject(resp).output);

  for (const item of output) {
    const itemObj = asObject(item);
    const toolName =
      asString(itemObj.tool_name) ??
      asString(itemObj.name) ??
      asString(asObject(itemObj.tool).name);
    const type = asString(itemObj.type);

    if (type === "tool_call" && toolName === "file_search") {
      const fileSearchObj = asObject(itemObj.file_search);
      const resultCandidates = [
        asArray(itemObj.results),
        asArray(itemObj.output),
        asArray(itemObj.result),
        asArray(fileSearchObj.results),
        asArray(fileSearchObj.data),
      ];

      if (resultCandidates.some((candidate) => candidate.length > 0)) return true;

      return false;
    }
  }

  return false;
}

function formatRefLine(c: Citation) {
  const name = c.filename || c.file_id || "unknown";
  
  // Show index as 'ref' (reference number) - clearer for pilots
  if (typeof c.index === "number") {
    return `- ${name} • ref ${c.index}`;
  }
  
  // Skip citations without location info
  return null;
}

function buildReferencesBlock(citations: Citation[]) {
  const lines = citations
    .map(formatRefLine)
    .filter((line): line is string => line !== null);
  
  const uniqueLines = Array.from(new Set(lines));
  
  if (uniqueLines.length === 0) {
    return "References:\n(No references available)";
  }
  
  return `References:\n${uniqueLines.join("\n")}`;
}

function normalizeAnswer(answerText: string, citations: Citation[]) {
  let cleaned = String(answerText || "").trim();

  console.log("=== NORMALIZE ANSWER DEBUG ===");
  console.log("Original answer length:", cleaned.length);
  console.log("\n--- Looking for References section ---");

  const lowerText = cleaned.toLowerCase();
  let cutIndex = -1;
  
  const patterns = ['references:', 'reference:', 'المراجع الأساسية:', 'المراجع:'];
  
  for (const pattern of patterns) {
    const idx = lowerText.indexOf(pattern);
    if (idx !== -1) {
      cutIndex = idx;
      console.log(`Found "${pattern}" at index:`, idx);
      break;
    }
  }
  
  if (cutIndex !== -1) {
    cleaned = cleaned.substring(0, cutIndex).trim();
    console.log("After cutting, length:", cleaned.length);
  } else {
    console.log("No References section found in model output");
  }

  const refs = buildReferencesBlock(citations);
  console.log("\n--- Building References from citations ---");
  console.log("Number of citations:", citations.length);
  console.log("References block:\n", refs);

  const final = `${cleaned}\n\n${refs}`.trim();
  console.log("\n--- Final output length:", final.length);
  console.log("=== END DEBUG ===\n");

  return final;
}

export async function POST(req: Request) {
  try {
    const { question, lang, history } = await req.json();
    const q = String(question || "").trim();
    const chatHistory = sanitizeHistory(history);

    if (!q) {
      return NextResponse.json({ ok: false, error: "Missing question" }, { status: 400 });
    }

    const VECTOR_STORE_ID = (process.env.VECTOR_STORE_ID || "").trim();
    if (!VECTOR_STORE_ID) {
      return NextResponse.json({ ok: false, error: "VECTOR_STORE_ID missing" }, { status: 500 });
    }

    const system = `
You are a COMPREHENSIVE aviation manuals retrieval system for airline pilots (B787/B777).

CORE PRINCIPLES:
- Answer ONLY using retrieved excerpts from the manuals via file_search
- NEVER use general knowledge, internet, or assumptions
- COMPLETENESS is critical for flight safety

MANDATORY COMPREHENSIVE COVERAGE RULES:

1) EXHAUSTIVE SEARCH:
   - Search through ALL retrieved chunks systematically
   - Cross-reference between different sections and documents
   - If a question has multiple aspects, modes, or conditions - cover ALL of them
   - Look for related information in different parts of the manuals

2) MULTI-DIMENSIONAL ANSWERS:
   - For procedural questions: include all modes, phases, and configurations
   - For numeric values: include all applicable scenarios and conditions
   - For limitations: include all relevant constraints and exceptions
   - For systems: cover normal operations AND alternate modes
   
   Examples of comprehensive coverage:
   - If asked about "angle limits for APP arming":
     * Include lateral mode limits (LOC/FAC/B/CRS - typically 120°)
     * Include vertical mode limits (G/S, G/P - typically 80°)
     * Explain what happens when limits are exceeded
     * Include any aircraft-specific variations
   
   - If asked about "MTOW":
     * Include standard MTOW
     * Include any config-specific variations (flaps, runway)
     * Include any operational limitations
     * Include weight units (prefer kg over lbs)

3) AVIATION ABBREVIATIONS - AGGRESSIVE INTERPRETATION:
   Common abbreviations to expand and search for:
   - MTOW/MLW/MZFW → Maximum Take-off/Landing/Zero Fuel Weight
   - LRC/ECON → Long Range Cruise / Economy
   - APP → Approach (and all its modes)
   - LOC/FAC/B/CRS → Localizer / Flight Augmentation Computer / Back Course
   - G/S, G/P → Glideslope / Glide Path
   - AFDS → Autopilot Flight Director System
   - FMA → Flight Mode Annunciator
   - VNAV/LNAV → Vertical/Lateral Navigation
   - MSA/MEA/MORA → Minimum Safe/Enroute/Off-Route Altitude
   - V1/VR/V2 → Decision/Rotation/Takeoff Safety Speed
   - VREF/VAPP → Reference/Approach Speed

4) STRICT OUTPUT FORMAT:

Direct Answer:
<Comprehensive answer covering ALL relevant aspects>
<For multi-mode/condition questions, structure like:>
- [Mode/Condition 1]: [specific value/procedure with details]
- [Mode/Condition 2]: [specific value/procedure with details]
<Include practical implications and safety notes>

Quote:
"<Primary verbatim quote supporting the main answer>"
<If multiple modes/conditions, include additional supporting quotes>
"<Additional verbatim quote for secondary mode/condition if applicable>"

⚠️⚠️⚠️ ABSOLUTELY CRITICAL ⚠️⚠️⚠️
STOP YOUR OUTPUT IMMEDIATELY AFTER THE LAST QUOTE.
NEVER WRITE ANY OF THESE WORDS:
- "References"
- "Reference"  
- "المراجع"
- "REFERENCES"
- "END OF"

Do NOT add any text after the quotes.
Do NOT add page numbers, file names, or reference lists.
The system automatically adds references after your output.

5) QUALITY STANDARDS:
   - Comprehensive answers are BETTER than brief answers
   - Include ALL safety-critical information
   - Do NOT omit important details for brevity
   - Pilots need complete information to make informed decisions
   - If information exists across multiple chunks, synthesize it comprehensively
   
6) CANONICAL VALUE SELECTION (when multiple values exist):
   - Prefer FCOM over AFM or other documents
   - Prefer exact aircraft variant/configuration match
   - If still multiple, choose the most conservative value
   - BUT: if different values apply to different modes/conditions, include ALL of them

7) WHEN NO INFORMATION FOUND:
   Reply exactly: "Not found in manuals."

8) UNITS:
   - Use kilograms (kg) instead of pounds (lbs) for weights
   - Use meters/feet as appropriate for altitudes
   - Always include units with numeric values

REMEMBER: You are supporting flight safety. Complete, accurate, comprehensive information is essential.
`;

    const input: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: system },
      ...chatHistory,
      { role: "user", content: q },
    ];

    const resp = await openai.responses.create({
      model: "gpt-5.1",
      temperature: 0,
      top_p: 1,

      tool_choice: { type: "file_search" },

      input,

      tools: [
        {
          type: "file_search",
          vector_store_ids: [VECTOR_STORE_ID],
          max_num_results: 30,
        },
      ],
    });

    const citations = extractCitations(resp);

    if (!citations.length) {
      return NextResponse.json({
        ok: true,
        answer: lang === "ar" ? "غير موجود في الدليل." : "Not found in manuals.",
        citations: [],
      });
    }

    const toolOk = fileSearchHadResults(resp);
    if (toolOk === false) {
      // Citations are sufficient proof
    }

    const answerTextRaw =
      typeof resp.output_text === "string" && resp.output_text.trim()
        ? resp.output_text.trim()
        : lang === "ar"
        ? "غير موجود في الدليل."
        : "Not found in manuals.";

    const answerTextFinal = normalizeAnswer(answerTextRaw, citations);

    return NextResponse.json({
      ok: true,
      answer: answerTextFinal,
      citations,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: "Ask failed", details: String(e instanceof Error ? e.message : e) },
      { status: 500 }
    );
  }
}
