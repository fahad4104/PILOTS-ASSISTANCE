import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const filename = new URL(req.url).searchParams.get("filename")!;
  const blob = await put(filename, req.body!, { access: "public" });
  return NextResponse.json({ url: blob.url });
}
