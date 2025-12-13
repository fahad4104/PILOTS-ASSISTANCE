import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";

function assertAdmin(req: Request) {
  const headerSecret = (req.headers.get("x-admin-secret") || "").trim();
  const serverSecret = (process.env.ADMIN_SECRET || "").trim();

  if (!serverSecret) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "ADMIN_SECRET missing" }, { status: 500 }),
    };
  }
  if (headerSecret !== serverSecret) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const auth = assertAdmin(req);
    if (!auth.ok) return auth.res;

    const vectorStoreId = (process.env.VECTOR_STORE_ID || "").trim();
    if (!vectorStoreId) {
      return NextResponse.json({ error: "VECTOR_STORE_ID missing" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));
    const vsFileId = String(body?.vector_store_file_id ?? "").trim();
    if (!vsFileId) {
      return NextResponse.json({ error: "Missing vector_store_file_id" }, { status: 400 });
    }

    // ✅ حل اختلاف typings بين نسخ SDK
    const item = await (openai as any).vectorStores.files.retrieve(vectorStoreId, vsFileId);

    return NextResponse.json({
      ok: true,
      vectorStoreId,
      vector_store_file_id: vsFileId,
      status: item?.status,
      last_error: item?.last_error ?? null,
      raw: item,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Index status failed",
        details: String(err?.message ?? err),
        raw: err,
      },
      { status: 500 }
    );
  }
}
