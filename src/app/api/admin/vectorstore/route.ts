import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const headerSecret = (req.headers.get("x-admin-secret") || "").trim();
  const serverSecret = (process.env.ADMIN_SECRET || "").trim();

  if (!serverSecret) {
    return NextResponse.json({ error: "ADMIN_SECRET missing" }, { status: 500 });
  }
  if (headerSecret !== serverSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vectorStoreId = process.env.VECTOR_STORE_ID;
  if (!vectorStoreId) {
    return NextResponse.json({ error: "VECTOR_STORE_ID missing" }, { status: 500 });
  }

  const list = await openai.vectorStores.files.list(vectorStoreId, { limit: 50 } as any);
  const data = (list as any).data ?? [];

  return NextResponse.json({
    ok: true,
    vectorStoreId,
    count: data.length,
    files: data.map((f: any) => ({
      id: f.id,
      status: f.status,
      created_at: f.created_at,
      attributes: f.attributes,
    })),
  });
}
