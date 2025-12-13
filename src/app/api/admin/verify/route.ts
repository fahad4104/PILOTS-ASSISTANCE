import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const secret = String(body?.secret ?? "").trim();

    const serverSecret = String(process.env.ADMIN_SECRET ?? "").trim();

    if (!serverSecret) {
      return NextResponse.json(
        { error: "ADMIN_SECRET missing in env" },
        { status: 500 }
      );
    }

    if (secret !== serverSecret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: "verify failed", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
