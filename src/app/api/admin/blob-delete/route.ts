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

// DELETE /api/admin/blob-delete  body: { url?: string; pathname?: string }
export async function DELETE(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  try {
    const body = await req.json().catch(() => ({}));
    const url = (body?.url || "").trim();
    const pathname = (body?.pathname || "").trim();

    if (!url && !pathname) {
      return NextResponse.json(
        { ok: false, error: "Provide url or pathname" },
        { status: 400 }
      );
    }

    // del() يقبل URL أو pathname حسب نسخة SDK — نمرر الموجود
    await del((url || pathname) as any, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Delete failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
