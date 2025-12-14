"use client";

import { useMemo, useState } from "react";

type Json = any;

function tryParseJson(text: string): { ok: true; data: any } | { ok: false; raw: string } {
  if (!text) return { ok: true, data: {} };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, raw: text };
  }
}

export default function AdminUploadPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState("fcom_787");
  const [deleteOld, setDeleteOld] = useState(true);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Json>(null);

  const canSubmit = useMemo(() => {
    return adminSecret.trim().length > 0 && !!file && key.trim().length > 0;
  }, [adminSecret, file, key]);

  async function safeFetchJson(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const text = await res.text();
    const parsed = tryParseJson(text);

    if (!parsed.ok) {
      // Non-JSON response (e.g., "Request Entity Too Large", HTML error page, etc.)
      return {
        ok: false,
        status: res.status,
        nonJson: true,
        raw: parsed.raw.slice(0, 1200),
      };
    }

    return {
      ok: res.ok && parsed.data?.ok !== false,
      status: res.status,
      data: parsed.data,
    };
  }

  async function replaceAndIndex() {
    setBusy(true);
    setResult(null);

    try {
      // 1) Upload file -> Vercel Blob (multipart/form-data)
      const fd = new FormData();
      fd.append("file", file as File);
      fd.append("key", key.trim());
      fd.append("deleteOldVersions", deleteOld ? "true" : "false");

      const up = await safeFetchJson("/api/admin/upload", {
        method: "POST",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
        body: fd,
      });

      if (!up.ok) {
        setResult({
          step: "upload",
          ...up,
        });
        return;
      }

      const newBlobUrl = up.data?.newBlobUrl || up.data?.url;
      if (!newBlobUrl) {
        setResult({
          step: "upload",
          error: "Upload succeeded but newBlobUrl missing",
          debug: up.data,
        });
        return;
      }

      // 2) Replace+Index -> send JSON only (no file!)
      const rep = await safeFetchJson("/api/admin/replace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({
          key: key.trim(),
          blobUrl: newBlobUrl,
          deleteOldVersions: deleteOld,
        }),
      });

      if (!rep.ok) {
        setResult({
          step: "replace",
          upload: up.data,
          ...rep,
        });
        return;
      }

      setResult({
        ok: true,
        step: "done",
        upload: up.data,
        replace: rep.data,
      });
    } catch (e: any) {
      setResult({ ok: false, error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Library</h1>

      <section className="border rounded p-4 space-y-4 bg-white">
        <h2 className="text-lg font-semibold">Replace PDF (Single File)</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium">Admin Secret</label>
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Enter ADMIN_SECRET"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Choose File (PDF)</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <div className="text-sm text-gray-600">
              Selected: {file.name} ({Math.round(file.size / 1024)} KB)
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Key (e.g. fcom_787 / fctm / qrh_777)</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full max-w-xs border rounded px-3 py-2"
            placeholder="fcom_787"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={deleteOld}
            onChange={(e) => setDeleteOld(e.target.checked)}
          />
          Delete old versions (optional)
        </label>

        <button
          onClick={replaceAndIndex}
          disabled={!canSubmit || busy}
          className="px-5 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {busy ? "Working..." : "Replace & Index"}
        </button>

        <div className="border rounded p-3 bg-gray-50">
          <pre className="text-xs overflow-auto">{JSON.stringify(result ?? {}, null, 2)}</pre>
        </div>
      </section>
    </main>
  );
}
