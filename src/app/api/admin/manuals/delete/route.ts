import { NextResponse } from "next/server";
import OpenAI from "openai";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

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

type Body = {
  key: string;
};

export async function POST(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
  const BLOB_TOKEN =
    (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || "").trim();

  if (!OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });
  }
  if (!BLOB_TOKEN) {
    return NextResponse.json({ ok: false, error: "BLOB_READ_WRITE_TOKEN missing" }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON (expects { key })" }, { status: 400 });
  }

  const k = String(body.key || "").trim().toLowerCase();
  if (!k) {
    return NextResponse.json({ ok: false, error: "Missing key" }, { status: 400 });
  }

  const manual = await prisma.manual.findUnique({ where: { key: k } });
  if (!manual) {
    return NextResponse.json({ ok: false, error: "Manual not found" }, { status: 404 });
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const steps: Array<{ step: string; ok: boolean; details?: string }> = [];

  // 1) Delete OpenAI File (removes it from all vector stores that reference it)
  try {
    // SDK الحديثة: files.del(fileId)
    await client.files.delete(manual.openaiFileId);
    steps.push({ step: "openai.files.del", ok: true });
  } catch (e: any) {
    // fallback لو اختلاف SDK
    try {
      await (client as any).files.delete(manual.openaiFileId);
      steps.push({ step: "openai.files.delete(fallback)", ok: true });
    } catch (e2: any) {
      steps.push({
        step: "openai.files.del",
        ok: false,
        details: String(e2?.message ?? e?.message ?? e2 ?? e),
      });
    }
  }

  // 2) Delete Blob (by URL is safest)
  try {
    await del(manual.blobUrl, { token: BLOB_TOKEN });
    steps.push({ step: "vercel.blob.del(url)", ok: true });
  } catch (e: any) {
    // fallback: try pathname if URL fails
    try {
      if (manual.blobPathname) {
        await del(manual.blobPathname, { token: BLOB_TOKEN });
        steps.push({ step: "vercel.blob.del(pathname fallback)", ok: true });
      } else {
        steps.push({ step: "vercel.blob.del", ok: false, details: "No blobPathname fallback available" });
      }
    } catch (e2: any) {
      steps.push({ step: "vercel.blob.del", ok: false, details: String(e2?.message ?? e2) });
    }
  }

  // 3) Delete DB record
  try {
    await prisma.manual.delete({ where: { key: k } });
    steps.push({ step: "prisma.manual.delete", ok: true });
  } catch (e: any) {
    steps.push({ step: "prisma.manual.delete", ok: false, details: String(e?.message ?? e) });
  }

  const ok = steps.every((s) => s.ok);
  return NextResponse.json({ ok, deletedKey: k, steps });
}
