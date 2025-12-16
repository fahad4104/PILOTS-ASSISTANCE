import { NextResponse } from "next/server";
import { del } from "@vercel/blob";

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

export async function POST(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  const token = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!token) {
    return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN missing" }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const urlOrPath = String(body?.url ?? body?.pathname ?? "").trim();

    if (!urlOrPath) {
      return NextResponse.json({ ok: false, error: "Provide url or pathname" }, { status: 400 });
    }

    // del يقبل url مباشرة أو pathname
    await del(urlOrPath, { token });

    return NextResponse.json({ ok: true, deleted: urlOrPath });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Delete failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
