import { NextResponse } from "next/server";
import { del } from "@vercel/blob";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const headerSecret = (req.headers.get("x-admin-secret") || "").trim();
  const serverSecret = (process.env.ADMIN_SECRET || "").trim();

  if (!serverSecret) {
    return NextResponse.json(
      { error: "ADMIN_SECRET missing in env" },
      { status: 500 }
    );
  }

  if (headerSecret !== serverSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const url = String(body?.url ?? "");

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });

  return NextResponse.json({ ok: true });
}
