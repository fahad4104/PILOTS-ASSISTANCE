import { NextResponse } from "next/server";

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

type VSFile = {
  id: string;           // vector_store_file_id
  file_id?: string;     // openai file_id (sometimes present)
  created_at?: number;
  status?: string;
};

type VSListResp = {
  data: VSFile[];
  has_more?: boolean;
};

async function openaiFetch(apiKey: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { nonJson: true, raw: text };
  }

  if (!res.ok) {
    const msg = json?.error?.message || json?.raw || `OpenAI API error (${res.status})`;
    throw new Error(msg);
  }

  return json;
}

export async function POST(req: Request) {
  const auth = assertAdmin(req);
  if (!auth.ok) return auth.res;

  const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
  const VECTOR_STORE_ID = (process.env.VECTOR_STORE_ID || "").trim();

  if (!OPENAI_API_KEY) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });
  if (!VECTOR_STORE_ID) return NextResponse.json({ ok: false, error: "VECTOR_STORE_ID missing" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const deleteFilesToo = Boolean(body?.deleteFilesToo); // إذا true: يحذف ملفات OpenAI نفسها أيضاً

  let deletedFromVS = 0;
  let deletedFiles = 0;

  const failures: Array<{ step: string; id?: string; file_id?: string; error: string }> = [];

  try {
    let after: string | undefined = undefined;

    while (true) {
      const qs = new URLSearchParams({ limit: "100" });
      if (after) qs.set("after", after);

      // LIST vector store files
      const page = (await openaiFetch(
        OPENAI_API_KEY,
        `/vector_stores/${encodeURIComponent(VECTOR_STORE_ID)}/files?${qs.toString()}`,
        { method: "GET" }
      )) as VSListResp;

      const items = Array.isArray(page?.data) ? page.data : [];
      if (items.length === 0) break;

      for (const it of items) {
        const vsFileId = it?.id;
        if (!vsFileId) continue;

        // Retrieve to get file_id reliably
        let fileId: string | undefined = it.file_id;
        try {
          const full = await openaiFetch(
            OPENAI_API_KEY,
            `/vector_stores/${encodeURIComponent(VECTOR_STORE_ID)}/files/${encodeURIComponent(vsFileId)}`,
            { method: "GET" }
          );
          fileId = full?.file_id || fileId;
        } catch (e: any) {
          // not fatal
        }

        // 1) Detach from vector store
        try {
          await openaiFetch(
            OPENAI_API_KEY,
            `/vector_stores/${encodeURIComponent(VECTOR_STORE_ID)}/files/${encodeURIComponent(vsFileId)}`,
            { method: "DELETE" }
          );
          deletedFromVS++;
        } catch (e: any) {
          failures.push({ step: "vs.detach", id: vsFileId, file_id: fileId, error: String(e?.message ?? e) });
          continue; // لو فشل detach لا تكمل delete file
        }

        // 2) Optionally delete the OpenAI file itself
        if (deleteFilesToo && fileId) {
          try {
            await openaiFetch(OPENAI_API_KEY, `/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
            deletedFiles++;
          } catch (e: any) {
            failures.push({ step: "files.delete", id: vsFileId, file_id: fileId, error: String(e?.message ?? e) });
          }
        }
      }

      if (!page?.has_more) break;
      after = items[items.length - 1]?.id;
      if (!after) break;
    }

    return NextResponse.json({
      ok: true,
      vectorStoreId: VECTOR_STORE_ID,
      deletedFromVS,
      deletedFiles,
      deleteFilesToo,
      failures,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        step: "vectorstore_clear",
        error: "Vector store clear failed",
        details: String(e?.message ?? e),
        deletedFromVS,
        deletedFiles,
        deleteFilesToo,
        failures,
      },
      { status: 500 }
    );
  }
}
