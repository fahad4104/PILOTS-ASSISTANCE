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

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const steps: Array<{ step: string; ok: boolean; details?: string }> = [];
  let openaiFileId: string | undefined;

  // 0) get openai file id (optional)
  try {
    const full = await (client as any).vectorStores.files.retrieve(VECTOR_STORE_ID, vsFileId);
    openaiFileId = full?.file_id;
    steps.push({ step: "vectorStores.files.retrieve", ok: true });
  } catch (e: any) {
    steps.push({ step: "vectorStores.files.retrieve", ok: false, details: String(e?.message ?? e) });
  }

  // 1) detach from vector store
  try {
    await (client as any).vectorStores.files.del(VECTOR_STORE_ID, vsFileId);
    steps.push({ step: "vectorStores.files.del", ok: true });
  } catch (e: any) {
    steps.push({ step: "vectorStores.files.del", ok: false, details: String(e?.message ?? e) });
  }

  // 2) optionally delete the OpenAI file
  if (deleteFileToo) {
    if (!openaiFileId) {
      steps.push({ step: "files.del", ok: false, details: "openaiFileId missing (could not retrieve)" });
    } else {
      try {
        await (client as any).files.del(openaiFileId);
        steps.push({ step: "files.del", ok: true });
      } catch (e: any) {
        steps.push({ step: "files.del", ok: false, details: String(e?.message ?? e) });
      }
    }
  }

  const ok = steps.every((s) => s.ok || s.step === "files.del"); // files.del optional
  return NextResponse.json({
    ok,
    vectorStoreId: VECTOR_STORE_ID,
    vs_file_id: vsFileId,
    openai_file_id: openaiFileId,
    deleteFileToo,
    steps,
  });
}
