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

function safeKey(input: string) {
  const k = input.trim().toLowerCase().replace(/\s+/g, "_");
  if (!/^[a-z0-9_-]+$/.test(k)) return null;
  return k;
}

async function toNodeFileFromBlobUrl(blobUrl: string, filename: string) {
  const r = await fetch(blobUrl, { cache: "no-store" });
  if (!r.ok) throw new Error(`Failed to fetch blob url: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return new File([buf], filename, { type: "application/pdf" });
}

// POST /api/admin/replace
// body: { key: string, blobUrl: string, deleteOldVersions?: boolean }
export async function POST(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  const vectorStoreId = (process.env.VECTOR_STORE_ID || "").trim();
  if (!vectorStoreId) {
    return NextResponse.json(
      { error: "VECTOR_STORE_ID missing" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const keyRaw = String(body?.key ?? "");
    const key = safeKey(keyRaw);
    const blobUrl = String(body?.blobUrl ?? "").trim();
    const deleteOldVersions = Boolean(body?.deleteOldVersions ?? true);

    if (!key) {
      return NextResponse.json(
        { error: "Invalid key. Use letters/numbers/_/- only." },
        { status: 400 }
      );
    }
    if (!blobUrl || !/^https?:\/\//i.test(blobUrl)) {
      return NextResponse.json(
        { error: "Missing/invalid blobUrl" },
        { status: 400 }
      );
    }

    const openai = getOpenAI();

    // 1) Upload to OpenAI Files (server fetches from Blob URL)
    const nodeFile = await toNodeFileFromBlobUrl(blobUrl, `${key}.pdf`);
    const openaiFile = await openai.files.create({
      file: nodeFile as any,
      purpose: "assistants",
    } as any);

    const openaiFileId = (openaiFile as any)?.id ?? null;
    if (!openaiFileId) {
      return NextResponse.json(
        { error: "OpenAI files.create returned no id" },
        { status: 500 }
      );
    }

    // 2) Attach to Vector Store (start indexing)
    const vsFile = await (openai as any).vectorStores.files.create(
      vectorStoreId,
      {
        file_id: openaiFileId,
        attributes: {
          key,
          blob_url: blobUrl,
        },
      }
    );

    const vectorStoreFileId = vsFile?.id ?? null;
    if (!vectorStoreFileId) {
      return NextResponse.json(
        { error: "vectorStores.files.create returned no id", vsFile },
        { status: 500 }
      );
    }

    // 3) Optional: delete older versions for same key (keep latest)
    // ملاحظة: هذا يعتمد على أنك خزّنت key داخل attributes.
    // لو تحب نفعّل حذف النسخ القديمة بشكل مضبوط 100% نضيف list+filter هنا.
    // الآن نخليه بسيط (بدون حذف) لتجنب أي لخبطة:
    // if (deleteOldVersions) { ... }

    return NextResponse.json({
      ok: true,
      indexed: "started",
      key,
      blobUrl,
      openai_file_id: openaiFileId,
      vector_store_file_id: vectorStoreFileId,
      deleteOldVersions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Replace failed", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
