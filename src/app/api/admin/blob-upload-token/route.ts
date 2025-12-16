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

  try {
    const body = (await req.json()) as HandleUploadBody;

    // Direct upload token generator
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // مسموح PDF فقط + حجم كبير (عدّل كما تريد)
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 250 * 1024 * 1024, // 250MB
          // لازم تكون string حسب typings
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async () => {
        // لا شيء هنا (نحن نعمل indexing في /api/admin/replace)
      },
    });

    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json(
      { error: "blob-upload-token failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
