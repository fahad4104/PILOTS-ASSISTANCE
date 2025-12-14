import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

function safeKey(input: string) {
  const k = input.trim().toLowerCase().replace(/\s+/g, "_");
  if (!/^[a-z0-9_-]+$/.test(k)) return null;
  return k;
}

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

// POST /api/admin/upload (multipart/form-data)
// fields: file (PDF), key (string), deleteOldVersions? ("true"/"false") (optional)
export async function POST(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  const blobToken = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!blobToken) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN missing" },
      { status: 500 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    const keyRaw = String(form.get("key") ?? "");
    const key = safeKey(keyRaw);

    const deleteOldVersions =
      String(form.get("deleteOldVersions") ?? "true").toLowerCase() !== "false";

    if (!key) {
      return NextResponse.json(
        { error: "Invalid key. Use letters/numbers/_/- only." },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF allowed" }, { status: 400 });
    }

    // نخزن باسم مرتب داخل مجلد المفتاح
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const pathname = `manuals/${key}/${stamp}.pdf`;

    const blob = await put(pathname, file, {
      access: "public",
      token: blobToken,
      addRandomSuffix: false,
    });

    // رابط ثابت (اختياري) لو عندك /api/files/[...path] route
    const stableUrl = `/api/files/${key}.pdf`;

    return NextResponse.json({
      ok: true,
      key,
      stableUrl,
      newBlobUrl: blob.url,
      blobPathname: blob.pathname,
      size: file.size,
      deleteOldVersions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Upload failed", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
