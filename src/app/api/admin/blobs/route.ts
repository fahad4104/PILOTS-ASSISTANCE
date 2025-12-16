import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

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

// GET /api/admin/blobs?prefix=manuals/&cursor=...
export async function GET(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  try {
    const { searchParams } = new URL(req.url);
    const prefix = searchParams.get("prefix") || "manuals/";
    const cursor = searchParams.get("cursor") || undefined;

    const result = await list({
      prefix,
      cursor,
      limit: 100,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      ok: true,
      prefix,
      blobs: result.blobs.map((b: any) => ({
        url: b.url,
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt,
        // ملاحظة: بعض نسخ @vercel/blob ما ترجع contentType في list()
      })),
      cursor: result.cursor ?? null,
      hasMore: result.hasMore ?? false,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "List failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
