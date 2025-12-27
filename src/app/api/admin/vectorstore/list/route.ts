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

type VSListItem = { id: string; created_at?: number; status?: string };
type VSListPage = { data: VSListItem[]; has_more?: boolean };

export async function GET(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
  const VECTOR_STORE_ID = (process.env.VECTOR_STORE_ID || "").trim();
  if (!OPENAI_API_KEY) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });
  if (!VECTOR_STORE_ID) return NextResponse.json({ ok: false, error: "VECTOR_STORE_ID missing" }, { status: 500 });

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const files: Array<{
    vs_file_id: string;
    openai_file_id?: string;
    created_at?: number;
    status?: string;
    filename?: string;
    bytes?: number;
    purpose?: string;
  }> = [];

  let after: string | undefined = undefined;

  try {
    while (true) {
      const page = (await (client as any).vectorStores.files.list(VECTOR_STORE_ID, {
        limit: 100,
        after,
      })) as VSListPage;

      const items = Array.isArray(page?.data) ? page.data : [];
      if (items.length === 0) break;

      for (const it of items) {
        const vsFileId = it.id;

        // 1) retrieve vs file -> gives openai file_id
        let openaiFileId: string | undefined;
        try {
          const full = await (client as any).vectorStores.files.retrieve(VECTOR_STORE_ID, vsFileId);
          openaiFileId = full?.file_id;
        } catch {
          openaiFileId = undefined;
        }

        // 2) retrieve file metadata -> gives filename
        let meta: any = null;
        if (openaiFileId) {
          try {
            meta = await (client as any).files.retrieve(openaiFileId);
          } catch {
            meta = null;
          }
        }

        files.push({
          vs_file_id: vsFileId,
          openai_file_id: openaiFileId,
          created_at: it.created_at,
          status: it.status,
          filename: meta?.filename,
          bytes: meta?.bytes,
          purpose: meta?.purpose,
        });
      }

      if (!page?.has_more) break;
      after = items[items.length - 1]?.id;
      if (!after) break;
    }

    files.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    return NextResponse.json({
      ok: true,
      vectorStoreId: VECTOR_STORE_ID,
      count: files.length,
      files,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Vector store list failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
