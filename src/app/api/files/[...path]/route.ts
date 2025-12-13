import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { path: string[] } }
) {
  const joined = (params.path || []).join("/");
  const key = joined.replace(/\.pdf$/i, "").trim();

  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const prefix = `manuals/${key}/`;
  const result = await list({
    token: process.env.BLOB_READ_WRITE_TOKEN,
    prefix,
    limit: 100,
  } as any);

  const blobs = (result as any).blobs as Array<any>;
  if (!blobs?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  blobs.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  return NextResponse.redirect(blobs[0].url);
}
