"use client";

import { useEffect, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";

type Tab = "upload" | "library";

type BlobItem = {
  url: string;
  downloadUrl: string | null;
  pathname: string;
  size: number;
  uploadedAt: string;
};

function safeJson(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, nonJson: true, raw: text };
  }
}

export default function AdminUploadPage() {
  const [tab, setTab] = useState<Tab>("upload");

  const [adminSecret, setAdminSecret] = useState("");
  const [key, setKey] = useState("");
  const [deleteOld, setDeleteOld] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  // direct-to-blob state
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [blobPathname, setBlobPathname] = useState<string>("");

  // library state
  const [loadingLib, setLoadingLib] = useState(false);
  const [blobs, setBlobs] = useState<BlobItem[]>([]);
  const [libError, setLibError] = useState<string | null>(null);

  const prefix = useMemo(() => "manuals/", []);

  async function refreshLibrary() {
    setLoadingLib(true);
    setLibError(null);
    try {
      const res = await fetch(
  `/api/admin/blobs?prefix=${encodeURIComponent(prefix)}&limit=200`,
  {
    method: "GET",
    cache: "no-store",
    headers: {
      "x-admin-secret": adminSecret.trim(),
    },
  }
);


      const text = await res.text();
      const data = safeJson(text);

      if (!res.ok || !data?.ok) {
        setLibError((data as any)?.error || (data as any)?.raw || `Failed (${res.status})`);
        setBlobs([]);
        return;
      }

      setBlobs(Array.isArray(data?.blobs) ? data.blobs : []);
    } catch (e: any) {
      setLibError(String(e?.message ?? e));
      setBlobs([]);
    } finally {
      setLoadingLib(false);
    }
  }

  useEffect(() => {
    if (tab === "library") refreshLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // مهم: إذا تغيّر الملف أو key، صفّر الـ blob الحالي لتفادي Replace على Blob قديم
  useEffect(() => {
    setBlobUrl("");
    setBlobPathname("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, key]);

  async function deleteBlob(pathname: string) {
    if (!adminSecret.trim()) {
      setResult({ ok: false, error: "Admin Secret required to delete" });
      return;
    }

    const yes = confirm(`Delete this file?\n${pathname}`);
    if (!yes) return;

    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/blob-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ pathname }),
      });

      const text = await res.text();
      const data = safeJson(text);

      if (!res.ok || !data?.ok) {
        setResult({ ok: false, status: res.status, ...data });
        return;
      }

      setResult({ ok: true, step: "delete", data });
      await refreshLibrary();
    } catch (e: any) {
      setResult({ ok: false, error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

  // 1) Direct upload to Blob
  async function uploadToBlob() {
    if (!adminSecret.trim()) {
      setResult({ ok: false, error: "Admin Secret required" });
      return;
    }
    if (!file) {
      setResult({ ok: false, error: "Choose a PDF file first" });
      return;
    }
    if (!key.trim()) {
      setResult({ ok: false, error: "Key required (e.g. fcom_787 / fctm / qrh_777)" });
      return;
    }

    setBusy(true);
    setResult(null);
    setBlobUrl("");
    setBlobPathname("");

    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setResult({ ok: false, error: "File must be a PDF" });
        return;
      }

      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const safeName = file.name.replace(/[^\w.\-()+\s]/g, "_");
      const pathname = `${prefix}${key.trim()}/${ts}-${safeName}`;

      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/admin/blob-upload-token",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
        clientPayload: JSON.stringify({ key: key.trim() }),
      });

      setBlobUrl(blob.url);
      setBlobPathname(blob.pathname);

      setResult({ ok: true, step: "blob_upload", blob });

      // حدّث الليبراري فقط إذا المستخدم فعلاً داخل تبويب Library
      if (tab === "library") await refreshLibrary();
    } catch (e: any) {
      setResult({ ok: false, step: "blob_upload", error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

  // 2) Replace & Index using blobUrl/blobPathname (JSON)
  async function replaceAndIndex() {
    if (!adminSecret.trim()) {
      setResult({ ok: false, error: "Admin Secret required" });
      return;
    }
    if (!key.trim()) {
      setResult({ ok: false, error: "Key required (e.g. fcom_787 / fctm / qrh_777)" });
      return;
    }
    if (!blobUrl.trim()) {
      setResult({ ok: false, error: "Upload to Blob first (missing blobUrl)" });
      return;
    }

    setBusy(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/replace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({
          key: key.trim(),
          blobUrl: blobUrl.trim(),
          blobPathname: blobPathname || undefined,
          deleteOld,
        }),
      });

      const text = await res.text();
      const data = safeJson(text);

      if (!res.ok || data?.ok === false) {
        setResult({ ok: false, step: (data as any)?.step || "replace", status: res.status, ...data });
        return;
      }

      setResult({ ok: true, step: (data as any)?.step || "replace", status: res.status, ...data });

      if (tab === "library") await refreshLibrary();
    } catch (e: any) {
      setResult({ ok: false, error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Library</h1>

      <div className="flex items-center gap-3">
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

      <section className="border rounded p-4">
        <label className="block text-sm font-semibold mb-2">Admin Secret</label>
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          placeholder="ADMIN_SECRET"
        />
      </section>

      {tab === "upload" && (
        <section className="border rounded p-4 space-y-4">
          <h2 className="text-xl font-semibold">Replace PDF (Direct to Blob)</h2>

          <div className="space-y-1">
            <label className="block text-sm font-medium">Choose File (PDF)</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <div className="text-sm text-gray-600">
                Selected: {file.name} ({Math.round(file.size / 1024)} KB)
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">Key (e.g. fcom_787 / fctm / qrh_777)</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="fcom_787"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={deleteOld} onChange={(e) => setDeleteOld(e.target.checked)} />
            Delete old versions (optional)
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={uploadToBlob}
              disabled={busy}
              className="px-5 py-2 rounded border bg-white disabled:opacity-50"
            >
              {busy ? "Working..." : "1) Upload to Blob"}
            </button>

            <button
              onClick={replaceAndIndex}
              disabled={busy || !blobUrl}
              className="px-5 py-2 rounded bg-black text-white disabled:opacity-50"
            >
              {busy ? "Working..." : "2) Replace & Index"}
            </button>
          </div>

          <div className="border rounded p-3 bg-gray-50 space-y-2">
            <div className="text-sm">
              <span className="font-semibold">Blob:</span>{" "}
              {blobUrl ? (
                <a className="underline break-all" href={blobUrl} target="_blank" rel="noreferrer">
                  {blobUrl}
                </a>
              ) : (
                <span className="text-gray-600">— not uploaded yet —</span>
              )}
            </div>
            <div className="text-xs font-mono break-all text-gray-700">{blobPathname || ""}</div>
            <pre className="text-xs overflow-auto">{JSON.stringify(result ?? {}, null, 2)}</pre>
          </div>
        </section>
      )}

      {tab === "library" && (
        <section className="border rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Library ({prefix})</h2>
            <button className="px-4 py-2 rounded border" onClick={refreshLibrary} disabled={loadingLib}>
              {loadingLib ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {libError && <div className="text-sm text-red-600">{libError}</div>}

          <div className="space-y-3">
            {blobs.length === 0 && !loadingLib ? (
              <div className="text-sm text-gray-600">No files found.</div>
            ) : (
              blobs.map((b) => (
                <div key={b.pathname} className="border rounded p-3">
                  <div className="font-mono text-sm break-all">{b.pathname}</div>
                  <div className="text-sm text-gray-600">
                    Size: {Math.round(b.size / 1024)} KB • Uploaded:{" "}
                    {b.uploadedAt ? new Date(b.uploadedAt).toLocaleString() : "—"}
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <a className="text-sm underline" href={b.url} target="_blank" rel="noreferrer">
                      Open
                    </a>

                    <button
                      className="text-sm px-3 py-1 rounded border"
                      onClick={() => deleteBlob(b.pathname)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </main>
  );
}
