import { NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { list, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Body = {
  key: string;
  blobUrl: string;
  blobPathname?: string;
  deleteOld?: boolean;
};

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
  const BLOB_TOKEN = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();

  if (!OPENAI_API_KEY) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });
  if (!VECTOR_STORE_ID) return NextResponse.json({ ok: false, error: "VECTOR_STORE_ID missing" }, { status: 500 });
  if (!BLOB_TOKEN) return NextResponse.json({ ok: false, error: "BLOB_READ_WRITE_TOKEN missing" }, { status: 500 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON (replace expects JSON: {key, blobUrl, blobPathname, deleteOld})" },
      { status: 400 }
    );
  }

  const key = String(body.key || "").trim().toLowerCase();
  const blobUrl = String(body.blobUrl || "").trim();
  const blobPathname = String(body.blobPathname || "").trim();
  const deleteOldRequested = Boolean(body.deleteOld);

  if (!key || !blobUrl) return NextResponse.json({ ok: false, error: "Missing key/blobUrl" }, { status: 400 });

  try {
    // 0) لو فيه Manual قديم بنفس key → نحتاج openaiFileId القديم عشان نحذفه لو deleteOld=true
    const existing = await prisma.manual.findUnique({ where: { key } }).catch(() => null);

    // 1) حذف النسخ القديمة من Blob (اختياري) — مع استثناء الملف الجديد
    let deletedBlobCount = 0;
    if (deleteOldRequested) {
      const prefix = `manuals/${key}/`;
      const result = await list({ prefix, limit: 1000, token: BLOB_TOKEN });

      const toDelete = result.blobs
        .filter((b) => {
          if (blobPathname) return b.pathname !== blobPathname;
          return b.url !== blobUrl;
        })
        .map((b) => b.url);

      if (toDelete.length) {
        await del(toDelete, { token: BLOB_TOKEN });
        deletedBlobCount = toDelete.length;
      }
    }

    // 2) تنزيل PDF من blobUrl
    const pdfRes = await fetch(blobUrl);
    if (!pdfRes.ok) {
      return NextResponse.json(
        { ok: false, error: "Failed to fetch blobUrl", details: `${pdfRes.status} ${pdfRes.statusText}` },
        { status: 400 }
      );
    }
    const buf = Buffer.from(await pdfRes.arrayBuffer());

    // 3) Upload إلى OpenAI Files
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const fileForOpenAI = await toFile(buf, `${key}.pdf`, { type: "application/pdf" });

    const uploaded = await client.files.create({ file: fileForOpenAI, purpose: "assistants" });

    // 4) Attach to Vector Store
    const vsFile = await (client as any).vectorStores.files.create(VECTOR_STORE_ID, {
      file_id: uploaded.id,
    });

    // 5) إذا deleteOld=true احذف ملف OpenAI القديم (يمسحه من كل vector stores)
    // مهم: لا تحذف القديم إذا deleteOld=false
    let deletedOldOpenAIFileId: string | null = null;
    if (deleteOldRequested && existing?.openaiFileId) {
      try {
        // OpenAI SDK: delete by id
        await (client as any).files.del(existing.openaiFileId);
        deletedOldOpenAIFileId = existing.openaiFileId;
      } catch {
        // لا تفشل العملية كاملة بسبب حذف قديم
      }
    }

    // 6) Upsert في DB (Library الحقيقي)
    const saved = await prisma.manual.upsert({
      where: { key },
      create: {
        key,
        originalName: `${key}.pdf`,
        blobUrl,
        blobPathname: blobPathname || `manuals/${key}/(unknown)`,
        openaiFileId: uploaded.id,
      },
      update: {
        originalName: `${key}.pdf`,
        blobUrl,
        blobPathname: blobPathname || `manuals/${key}/(unknown)`,
        openaiFileId: uploaded.id,
      },
    });

    return NextResponse.json({
      ok: true,
      key,
      blobUrl,
      blobPathname: blobPathname || null,
      openai_file_id: uploaded.id,
      vector_store_file_id: vsFile.id,
      deleteOldRequested,
      deletedOldBlobCount: deletedBlobCount,
      deletedOldOpenAIFileId,
      db: saved,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Replace/index failed", details: String(e?.message ?? e) }, { status: 500 });
  }
}
