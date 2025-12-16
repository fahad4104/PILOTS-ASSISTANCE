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

export async function GET(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  const token = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!token) {
    return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN missing" }, { status: 500 });
  }

  const url = new URL(req.url);
  const prefix = (url.searchParams.get("prefix") || "manuals/").trim(); // default: manuals/

  try {
    const result = await list({
      token,
      prefix,
      limit: 1000,
    });

    const items = (result.blobs || []).map((b) => ({
      pathname: b.pathname,
      url: b.url,
      downloadUrl: (b as any).downloadUrl ?? b.url,
      size: b.size,
      uploadedAt: (b as any).uploadedAt ?? null,
      contentType: (b as any).contentType ?? null,
    }));

    return NextResponse.json({ ok: true, prefix, count: items.length, items });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "List blobs failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
