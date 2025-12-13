import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const headerSecret = req.headers.get("x-admin-secret") || "";

    if (!process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: "ADMIN_SECRET missing" },
        { status: 500 }
      );
    }

    if (headerSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF allowed" }, { status: 400 });
    }

    const blob = await put(file.name, file, {
      access: "public",
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

   return NextResponse.json({
  ok: true,
  url: blob.url,
  pathname: blob.pathname,
  size: file.size,
});


  } catch (err: any) {
    return NextResponse.json(
      { error: "Upload failed", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
