import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const SECRET = process.env.ADMIN_SESSION_SECRET;

  if (!ADMIN_PASSWORD || !SECRET) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Session token (value + signature)
  const token = crypto.randomBytes(24).toString("hex");
  const sig = sign(token, SECRET);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("pa_admin", `${token}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
