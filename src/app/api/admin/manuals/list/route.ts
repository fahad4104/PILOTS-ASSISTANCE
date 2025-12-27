import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function assertAdmin(req: Request) {
  const headerSecret = (req.headers.get("x-admin-secret") || "").trim();
  const serverSecret = (process.env.ADMIN_SECRET || "").trim();
  if (!serverSecret) return { ok: false as const, res: NextResponse.json({ ok: false, error: "ADMIN_SECRET missing" }, { status: 500 }) };
  if (headerSecret !== serverSecret) return { ok: false as const, res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const };
}

export async function GET(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  const items = await prisma.manual.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, items });
}
