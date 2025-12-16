import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";

export const runtime = "nodejs";

function assertAdmin(req: Request) {
  const headerSecret = (req.headers.get("x-admin-secret") || "").trim();
  const serverSecret = (process.env.ADMIN_SECRET || "").trim();

  if (!serverSecret) {
    return { ok: false as const, res: NextResponse.json({ error: "ADMIN_SECRET missing" }, { status: 500 }) };
  }
  if (headerSecret !== serverSecret) {
    return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true as const };
}

function safeKey(input: string) {
  const k = input.trim().toLowerCase().replace(/\s+/g, "_");
  if (!/^[a-z0-9_-]+$/.test(k)) return null;
  return k;
}

async function toNodeFileFromBlobUrl(url: string, filename: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch blob url: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return new File([buf], filename, { type: "application/pdf" });
}

export async function POST(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  const vectorStoreId = (process.env.VECTOR_STORE_ID || "").trim();
  if (!vectorStoreId) {
    return NextResponse.json({ error: "VECTOR_STORE_ID missing" }, { status: 500 });
  }

  try {
    const openai = getOpenAI();

    const body = await req.json();
    const key = safeKey(String(body?.key ?? ""));
    const blobUrl = String(body?.blobUrl ?? "");
    const blobPathname = String(body?.blobPathname ?? "");
    const deleteOld = Boolean(body?.deleteOld ?? false);

    if (!key) return NextResponse.json({ error: "Invalid key (letters/numbers/_/- only)" }, { status: 400 });
    if (!blobUrl) return NextResponse.json({ error: "blobUrl missing" }, { status: 400 });

    // 1) Upload to OpenAI Files
    const nodeFile = await toNodeFileFromBlobUrl(blobUrl, `${key}.pdf`);
    const openaiFile = await openai.files.create({
      file: nodeFile as any,
      purpose: "assistants",
    } as any);

    const openaiFileId = (openaiFile as any)?.id;
    if (!openaiFileId) {
      return NextResponse.json({ error: "OpenAI file id missing" }, { status: 500 });
    }

    // 2) Attach to Vector Store (start indexing)
    const vsFile = await (openai as any).vectorStores.files.create(vectorStoreId, {
      file_id: openaiFileId,
      attributes: {
        key,
        blob_url: blobUrl,
        blob_path: blobPathname,
      },
    });

    const vectorStoreFileId = vsFile?.id ?? null;

    // ملاحظة: deleteOld اختياري—لو تبي لاحقاً نضيف حذف الإصدارات القديمة من الـ vector store + blob
    return NextResponse.json({
      ok: true,
      indexed: "started",
      key,
      blobUrl,
      blobPathname,
      openai_file_id: openaiFileId,
      vector_store_file_id: vectorStoreFileId,
      deleteOldRequested: deleteOld,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Replace+Index failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
