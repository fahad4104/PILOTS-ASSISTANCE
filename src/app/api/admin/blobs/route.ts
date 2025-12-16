import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

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

export async function GET(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: "BLOB_READ_WRITE_TOKEN missing" }, { status: 500 });
  }

  try {
    const url = new URL(req.url);

    const prefix = url.searchParams.get("prefix") || "manuals/";
    const cursor = url.searchParams.get("cursor") || undefined;
    const limit = Number(url.searchParams.get("limit") || "100");

    const result = await list({
      prefix,
      cursor,
      limit,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      ok: true,
      blobs: result.blobs.map((b) => ({
        url: b.url,
        downloadUrl: (b as any).downloadUrl ?? null,
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt,
      })),
      cursor: result.cursor ?? null,
      hasMore: result.hasMore ?? false,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
