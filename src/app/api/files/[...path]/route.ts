import { NextRequest, NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ path: string[] }> };

function extractKeyFromPath(pathParts: string[]) {
  // مثال: ["fcom_787.pdf"] -> "fcom_787"
  const last = pathParts[pathParts.length - 1] ?? "";
  const decoded = decodeURIComponent(last);

  // نسمح فقط بـ .pdf
  if (!decoded.toLowerCase().endsWith(".pdf")) return null;

  const key = decoded.slice(0, -4).trim(); // remove ".pdf"
  if (!key) return null;

  // نفس safeKey تقريباً (خفيف)
  if (!/^[a-z0-9_-]+$/i.test(key)) return null;

  return key;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { path } = await ctx.params;

    const key = extractKeyFromPath(path);
    if (!key) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const blobToken = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();
    if (!blobToken) {
      return NextResponse.json(
        { error: "BLOB_READ_WRITE_TOKEN missing" },
        { status: 500 }
      );
    }

    // نبحث عن أحدث ملف تحت manuals/<key>/
    const prefix = `manuals/${key}/`;
    const listed = await list({ prefix, token: blobToken });

    if (!listed.blobs?.length) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // أسماء ملفاتنا فيها timestamp ISO مضبوط => الفرز بالـ pathname يجيب الأحدث
    const latest = [...listed.blobs].sort((a, b) =>
      a.pathname.localeCompare(b.pathname)
    )[listed.blobs.length - 1];

    return NextResponse.redirect(latest.url, 302);
  } catch (e: any) {
    return NextResponse.json(
      { error: "files route failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
