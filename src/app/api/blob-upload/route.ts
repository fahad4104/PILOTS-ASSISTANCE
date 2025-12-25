import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const filename = new URL(req.url).searchParams.get("filename")?.trim();
    if (!filename) {
      return NextResponse.json({ ok: false, error: "Missing filename" }, { status: 400 });
    }

    // 1) Upload to Vercel Blob
    const blob = await put(filename, req.body!, { access: "public" });

    // 2) Validate env
    const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;
    if (!VECTOR_STORE_ID) {
      return NextResponse.json({ ok: false, error: "VECTOR_STORE_ID missing" }, { status: 500 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });
    }

    // 3) Fetch the uploaded file from Blob URL (server-side)
    const r = await fetch(blob.url);
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: "Failed to fetch uploaded blob", details: `${r.status} ${r.statusText}` },
        { status: 500 }
      );
    }

    const arrayBuffer = await r.arrayBuffer();

    // 4) Create OpenAI File from the bytes
    // Node 18+ has global File/Blob in Next runtime (nodejs).
    const file = new File([arrayBuffer], filename, { type: "application/pdf" });

    const created = await openai.files.create({
      file,
      purpose: "assistants",
    });

    // 5) Attach file to the Vector Store (this is the missing step)
    await openai.vectorStores.files.create(VECTOR_STORE_ID, {
      file_id: created.id,
    });

    return NextResponse.json({
      ok: true,
      url: blob.url,
      file_id: created.id,
      vector_store_id: VECTOR_STORE_ID,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Blob upload + index failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
