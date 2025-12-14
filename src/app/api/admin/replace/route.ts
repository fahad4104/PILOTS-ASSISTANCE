import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
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
    return NextResponse.json(
      {
        error: "Replace+Index failed",
        details:
          "VECTOR_STORE_ID missing in this route. Restart dev server after editing .env.local.",
      },
      { status: 500 }
    );
  }

  const blobToken = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!blobToken) {
    return NextResponse.json(
      { error: "Replace+Index failed", details: "BLOB_READ_WRITE_TOKEN missing" },
      { status: 500 }
    );
  }

  // ✅ مهم: أنشئ OpenAI client داخل الـ handler (بعد فحص الـ env)
  const openai = getOpenAI();

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const keyRaw = String(form.get("key") ?? "");
    const key = safeKey(keyRaw);

    if (!key) {
      return NextResponse.json(
        { error: "Invalid key. Use letters/numbers/_/- only." },
        { status: 400 }
      );
    }
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF allowed" }, { status: 400 });
    }

    // 1) Upload to Vercel Blob
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const pathname = `manuals/${key}/${stamp}.pdf`;

    const blob = await put(pathname, file, {
      access: "public",
      token: blobToken,
    });

    const stableUrl = `/api/files/${key}.pdf`;

    // 2) Upload to OpenAI Files
    let openaiFileId: string | null = null;
    try {
      const nodeFile = await toNodeFileFromBlobUrl(blob.url, `${key}.pdf`);
      const openaiFile = await openai.files.create({
        file: nodeFile as any,
        purpose: "assistants",
      } as any);

      openaiFileId = (openaiFile as any)?.id ?? null;

      if (!openaiFileId) {
        return NextResponse.json(
          {
            error: "Replace+Index failed",
            details: "openai.files.create succeeded but returned no file id",
            debug: { vectorStoreId, blobUrl: blob.url },
          },
          { status: 500 }
        );
      }
    } catch (e: any) {
      return NextResponse.json(
        {
          error: "Replace+Index failed",
          details: "OpenAI files.create failed",
          debug: {
            vectorStoreId,
            blobUrl: blob.url,
            message: String(e?.message ?? e),
          },
        },
        { status: 500 }
      );
    }

    // 3) Attach to Vector Store (start indexing)
    let vsFile: any = null;
    let vectorStoreFileId: string | null = null;

    try {
      vsFile = await (openai as any).vectorStores.files.create(vectorStoreId, {
        file_id: openaiFileId,
        attributes: {
          key,
          blob_url: blob.url,
          blob_path: blob.pathname,
        },
      });

      vectorStoreFileId = vsFile?.id ?? null;

      if (!vectorStoreFileId) {
        return NextResponse.json(
          {
            error: "Replace+Index failed",
            details: "vectorStores.files.create returned no id",
            debug: { vectorStoreId, openaiFileId, vsFile },
          },
          { status: 500 }
        );
      }
    } catch (e: any) {
      return NextResponse.json(
        {
          error: "Replace+Index failed",
          details: "OpenAI vectorStores.files.create failed",
          debug: {
            vectorStoreId,
            openaiFileId,
            message: String(e?.message ?? e),
          },
        },
        { status: 500 }
      );
    }

    // ✅ لا نحذف ولا نعمل list هنا حالياً
    return NextResponse.json({
      ok: true,
      indexed: "started",
      key,
      stableUrl,
      newBlobUrl: blob.url,
      blobPathname: blob.pathname,
      openai_file_id: openaiFileId,
      vector_store_file_id: vectorStoreFileId,
      debug_vsfile: vsFile, // مؤقتاً
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Replace+Index failed", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
