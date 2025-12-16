import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

function assertAdmin(req: Request) {
  const headerSecret = (req.headers.get("x-admin-secret") || "").trim();
  const serverSecret = (process.env.ADMIN_SECRET || "").trim();

  if (!serverSecret) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "ADMIN_SECRET missing" }, { status: 500 }),
    };
  }
  if (headerSecret !== serverSecret) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true as const };
}

export async function POST(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  const body = (await req.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname) => {
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 200 * 1024 * 1024, // 200MB
          tokenPayload: null, // ✅ لازم string أو null (مو object)
          // callbackUrl: process.env.VERCEL_BLOB_CALLBACK_URL, // اختياري فقط إذا تحتاج onUploadCompleted محلياً
        };
      },
      onUploadCompleted: async () => {
        // فاضي - لأننا نسوي indexing بعد الرفع عبر /api/admin/replace
      },
    });

    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json(
      { error: "blob token failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
