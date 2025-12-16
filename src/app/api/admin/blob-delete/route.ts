import { NextResponse } from "next/server";
import { del } from "@vercel/blob";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const headerSecret = (req.headers.get("x-admin-secret") || "").trim();
    const serverSecret = (process.env.ADMIN_SECRET || "").trim();

    if (!serverSecret) {
      return NextResponse.json({ ok: false, error: "ADMIN_SECRET missing" }, { status: 500 });
    }
    if (headerSecret !== serverSecret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const pathname = String(body?.pathname || "").trim();

    if (!pathname) {
      return NextResponse.json({ ok: false, error: "pathname required" }, { status: 400 });
    }

    await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });

    return NextResponse.json({ ok: true, deleted: pathname });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
