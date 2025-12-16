"use client";

import { useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";

type Tab = "upload" | "library";

export default function AdminUploadPage() {
  const [tab, setTab] = useState<Tab>("upload");

  const [adminSecret, setAdminSecret] = useState("");
  const [key, setKey] = useState("om-a");
  const [file, setFile] = useState<File | null>(null);
  const [deleteOld, setDeleteOld] = useState(true);

  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<any>(null);

  const canSubmit = useMemo(() => {
    return adminSecret.trim() && key.trim() && file;
  }, [adminSecret, key, file]);

  async function replaceAndIndex() {
    setBusy(true);
    setOut(null);

    try {
      if (!file) throw new Error("No file selected");

      // 1) Direct upload to Vercel Blob (client-side)
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const pathname = `manuals/${key.trim().toLowerCase()}/${stamp}.pdf`;

      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/admin/blob-upload-token",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
      });

      // 2) Call Replace route with blobUrl only (small JSON)
      const res = await fetch("/api/admin/replace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({
          key: key.trim(),
          blobUrl: blob.url,
          blobPathname: blob.pathname,
          deleteOld,
        }),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { nonJson: true, raw: text };
      }

      setOut({
        step: "index",
        status: res.status,
        ok: res.ok,
        data,
        blob,
      });
    } catch (e: any) {
      setOut({ error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Library</h1>

      <div className="flex gap-2">
        <button
          className={`px-4 py-2 rounded border ${tab === "upload" ? "bg-black text-white" : "bg-white"}`}
          onClick={() => setTab("upload")}
        >
          Upload PDF
        </button>
        <button
          className={`px-4 py-2 rounded border ${tab === "library" ? "bg-black text-white" : "bg-white"}`}
          onClick={() => setTab("library")}
        >
          Library
        </button>
      </div>

      {tab === "upload" && (
        <section className="border rounded p-5 space-y-4 bg-white">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Admin Secret</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="Enter ADMIN_SECRET"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Choose File (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <div className="text-sm text-gray-600">Selected: {file.name} ({Math.round(file.size / 1024)} KB)</div>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Key (e.g. fcom_787 / fctm / qrh_777)</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={deleteOld} onChange={(e) => setDeleteOld(e.target.checked)} />
            Delete old versions (optional)
          </label>

          <button
            onClick={replaceAndIndex}
            disabled={!canSubmit || busy}
            className="px-5 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {busy ? "Working..." : "Replace & Index"}
          </button>

          <div className="border rounded bg-gray-50 p-3 text-sm overflow-auto">
            <pre>{JSON.stringify(out ?? {}, null, 2)}</pre>
          </div>
        </section>
      )}

      {tab === "library" && (
        <section className="border rounded p-5 bg-white">
          <div className="text-sm text-gray-600">
            Library tab جاهز—إذا تبي أعرض لك قائمة الملفات المرفوعة من Blob (مع بحث/فلترة/روابط)،
            عطّني كود endpoint عندك اللي يسوي list (أو أبنيه لك).
          </div>
        </section>
      )}
    </main>
  );
}
