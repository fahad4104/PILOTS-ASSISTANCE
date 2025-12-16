import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const headerSecret = (req.headers.get("x-admin-secret") || "").trim();
  const serverSecret = (process.env.ADMIN_SECRET || "").trim();

  if (!serverSecret) {
    return NextResponse.json({ ok: false, error: "ADMIN_SECRET missing" }, { status: 500 });
  }
  if (headerSecret !== serverSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: "BLOB_READ_WRITE_TOKEN missing" }, { status: 500 });
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      body,
      request: req,

      onBeforeGenerateToken: async (pathname: string, clientPayload: string | null) => {
        // payload اختياري (مثلاً key)
        let key = "manual";
        try {
          const parsed = clientPayload ? JSON.parse(clientPayload) : null;
          if (parsed?.key) key = String(parsed.key).trim() || "manual";
        } catch {
          // ignore
        }

        const safePath = (pathname || "").toLowerCase();
        if (!safePath.endsWith(".pdf")) {
          return {
            allowedContentTypes: ["application/pdf"],
            tokenPayload: JSON.stringify({ ok: false }),
          };
        }

        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 200 * 1024 * 1024,
          tokenPayload: JSON.stringify({ key }),
        };
      },

      onUploadCompleted: async () => {
        // لا شيء — الـ indexing سيتم عبر /api/admin/replace
      },

      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json(json);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const status = msg.toLowerCase().includes("unauthorized") ? 401 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
