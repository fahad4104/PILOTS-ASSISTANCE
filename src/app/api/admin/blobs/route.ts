import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") || undefined;

  const result = await list({
    token: process.env.BLOB_READ_WRITE_TOKEN,
    cursor,
    limit: 50,
  });

  // نرجع بيانات مرتبة
 return NextResponse.json({
  ok: true,
  cursor: result.cursor ?? null,
  hasMore: result.hasMore ?? false,
  blobs: result.blobs.map((b) => ({
    url: b.url,
    pathname: b.pathname,
    size: b.size,
    uploadedAt: b.uploadedAt,
  })),
});

}
