import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

function assertAdmin(req: Request) {
  const headerSecret = (req.headers.get("x-admin-secret") || "").trim();
  const serverSecret = (process.env.ADMIN_SECRET || "").trim();

  if (!serverSecret) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "ADMIN_SECRET missing" }, { status: 500 }),
    };
  }
  if (headerSecret !== serverSecret) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true as const };
}

async function openaiFetch(apiKey: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // keep as text only
  }
  return { res, text, json };
}

export async function POST(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
  const VECTOR_STORE_ID = (process.env.VECTOR_STORE_ID || "").trim();

  if (!OPENAI_API_KEY) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });
  if (!VECTOR_STORE_ID) return NextResponse.json({ ok: false, error: "VECTOR_STORE_ID missing" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const vsFileId = String(body?.vs_file_id || "").trim();
  const deleteFileToo = Boolean(body?.deleteFileToo);

  if (!vsFileId) {
    return NextResponse.json({ ok: false, error: "Missing vs_file_id" }, { status: 400 });
  }

  // keep client in case you use it elsewhere later; not used for VS delete now
  // (prevents changing other behavior unexpectedly)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const steps: Array<{ step: string; ok: boolean; details?: string }> = [];
  let openaiFileId: string | undefined;

  // 0) determine the underlying openai file id:
  // In your UI/list, vs_file_id often already looks like "file-xxxx".
  // If it is, treat it as the OpenAI file id directly.
  if (vsFileId.startsWith("file-")) {
    openaiFileId = vsFileId;
    steps.push({ step: "detect_openai_file_id", ok: true });
  } else {
    // fallback: try retrieve via REST to get file_id
    try {
      const r = await openaiFetch(
        OPENAI_API_KEY,
        `/vector_stores/${VECTOR_STORE_ID}/files/${encodeURIComponent(vsFileId)}`,
        { method: "GET" }
      );
      if (!r.res.ok) {
        steps.push({
          step: "vector_stores.files.retrieve (REST)",
          ok: false,
          details: String(r.json?.error?.message || r.text || `HTTP ${r.res.status}`),
        });
      } else {
        openaiFileId = r.json?.file_id;
        steps.push({ step: "vector_stores.files.retrieve (REST)", ok: true });
      }
    } catch (e: any) {
      steps.push({ step: "vector_stores.files.retrieve (REST)", ok: false, details: String(e?.message ?? e) });
    }
  }

  // 1) detach from vector store (REST)
  try {
    // IMPORTANT: OpenAI VS detach expects the underlying file id (file-xxxx)
    const detachId = openaiFileId || vsFileId;

    const d = await openaiFetch(
      OPENAI_API_KEY,
      `/vector_stores/${VECTOR_STORE_ID}/files/${encodeURIComponent(detachId)}`,
      { method: "DELETE" }
    );

    if (!d.res.ok) {
      steps.push({
        step: "vector_stores.files.detach (REST)",
        ok: false,
        details: String(d.json?.error?.message || d.text || `HTTP ${d.res.status}`),
      });
    } else {
      steps.push({ step: "vector_stores.files.detach (REST)", ok: true });
    }
  } catch (e: any) {
    steps.push({ step: "vector_stores.files.detach (REST)", ok: false, details: String(e?.message ?? e) });
  }

  // 2) optionally delete the OpenAI file itself (REST)
  if (deleteFileToo) {
    if (!openaiFileId) {
      steps.push({ step: "files.del (REST)", ok: false, details: "openaiFileId missing (could not determine)" });
    } else {
      try {
        const del = await openaiFetch(OPENAI_API_KEY, `/files/${encodeURIComponent(openaiFileId)}`, {
          method: "DELETE",
        });

        if (!del.res.ok) {
          steps.push({
            step: "files.del (REST)",
            ok: false,
            details: String(del.json?.error?.message || del.text || `HTTP ${del.res.status}`),
          });
        } else {
          steps.push({ step: "files.del (REST)", ok: true });
        }
      } catch (e: any) {
        steps.push({ step: "files.del (REST)", ok: false, details: String(e?.message ?? e) });
      }
    }
  }

  // ok logic:
  // - detaching must succeed
  // - if deleteFileToo=true, file deletion must also succeed
  const mustBeOk = steps.filter((s) => {
    if (s.step === "detect_openai_file_id") return false;
    if (!deleteFileToo && s.step.startsWith("files.del")) return false;
    return true;
  });
  const ok = mustBeOk.every((s) => s.ok);

  return NextResponse.json({
    ok,
    vectorStoreId: VECTOR_STORE_ID,
    vs_file_id: vsFileId,
    openai_file_id: openaiFileId,
    deleteFileToo,
    steps,
  });
}
