import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";

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

export async function GET(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  try {
    const vectorStoreId = (process.env.VECTOR_STORE_ID || "").trim();
    if (!vectorStoreId) {
      return NextResponse.json({ error: "VECTOR_STORE_ID missing" }, { status: 500 });
    }

    const openai = getOpenAI();

    // محاولة خفيفة للتحقق أن المتجر موجود
    await (openai as any).vectorStores.retrieve(vectorStoreId);

    return NextResponse.json({ ok: true, vectorStoreId });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Vector store check failed", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
