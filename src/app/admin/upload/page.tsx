"use client";

import { useEffect, useMemo, useState } from "react";

type BlobItem = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt?: string;
  contentType?: string;
};

export default function AdminUploadPage() {
  const [tab, setTab] = useState<"upload" | "library">("upload");

  const [adminSecret, setAdminSecret] = useState("");

  // Upload (replace/index) inputs
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState("");
  const [deleteOld, setDeleteOld] = useState(true);

  // Upload result
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Library state
  const [libBusy, setLibBusy] = useState(false);
  const [blobs, setBlobs] = useState<BlobItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [libError, setLibError] = useState<string | null>(null);

  const prefix = "manuals/";

  const canReplace = useMemo(() => {
    return adminSecret.trim() && file && key.trim();
  }, [adminSecret, file, key]);

  async function replaceAndIndex() {
    setBusy(true);
    setResult(null);

    try {
      // 1) Get client upload token (optional if you already implemented it)
      // If you do not use blob-upload-token flow, remove this block and keep your existing flow.
      const tokenRes = await fetch("/api/admin/blob-upload-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({}),
      });

      const tokenText = await tokenRes.text();
      const tokenData = tokenText ? JSON.parse(tokenText) : {};
      if (!tokenRes.ok || tokenData?.error) {
        setResult({ step: "token", status: tokenRes.status, data: tokenData });
        setBusy(false);
        return;
      }

      // 2) Upload to Vercel Blob using your existing /api/blob-upload endpoint OR direct upload flow
      // NOTE: If you already have a working endpoint for uploading file to Blob, use it instead.
      // Here is a simple call to your existing upload endpoint (formData):
      const form = new FormData();
      form.append("file", file as File);

      const uploadRes = await fetch("/api/blob-upload", {
        method: "POST",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
        body: form,
      });

      const uploadText = await uploadRes.text();
      const uploadData = uploadText ? JSON.parse(uploadText) : {};
      if (!uploadRes.ok || uploadData?.error) {
        setResult({
          step: "upload",
          status: uploadRes.status,
          data: uploadData,
          nonJson: false,
        });
        setBusy(false);
        return;
      }

      const blobUrl: string = uploadData.url;

      // 3) Call your replace/index endpoint (expects JSON)
      const indexRes = await fetch("/api/admin/replace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({
          key: key.trim(),
          blobUrl,
          deleteOld: !!deleteOld,
        }),
      });

      const indexText = await indexRes.text();
      const indexData = indexText ? JSON.parse(indexText) : {};
      setResult({ step: "index", status: indexRes.status, data: indexData });
    } catch (e: any) {
      setResult({ error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

  async function loadLibrary(nextCursor?: string | null) {
    setLibBusy(true);
    setLibError(null);

    try {
      const url = new URL("/api/admin/blobs", window.location.origin);
      url.searchParams.set("prefix", prefix);
      if (nextCursor) url.searchParams.set("cursor", nextCursor);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok || data?.ok === false) {
        setLibError(data?.error || "Failed to load library");
        setLibBusy(false);
        return;
      }

      const newItems: BlobItem[] = Array.isArray(data?.blobs) ? data.blobs : [];
      if (nextCursor) {
        // pagination append
        setBlobs((prev) => [...prev, ...newItems]);
      } else {
        // first page
        setBlobs(newItems);
      }

      setCursor(data?.cursor ?? null);
      setHasMore(!!data?.hasMore);
    } catch (e: any) {
      setLibError(String(e?.message ?? e));
    } finally {
      setLibBusy(false);
    }
  }

  // auto-load library when user opens Library tab (if secret موجود)
  useEffect(() => {
    if (tab === "library" && adminSecret.trim()) {
      loadLibrary(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Library</h1>

      <div className="flex items-center gap-2">
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

      <section className="border rounded p-4 bg-white space-y-3">
        <label className="block text-sm font-medium">Admin Secret</label>
        <input
          type="password"
          className="w-full border rounded p-2"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          placeholder="Enter ADMIN_SECRET"
        />
      </section>

      {tab === "upload" && (
        <section className="border rounded p-4 bg-white space-y-4">
          <h2 className="text-lg font-semibold">Replace PDF (Single File)</h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Choose File (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <div className="text-sm text-gray-600">Selected: {file.name} ({Math.round(file.size / 1024)} KB)</div>}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Key (e.g. fcom_787 / fctm / qrh_777)</label>
            <input
              className="w-full border rounded p-2"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="fcom_787"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={deleteOld} onChange={(e) => setDeleteOld(e.target.checked)} />
            Delete old versions (optional)
          </label>

          <button
            onClick={replaceAndIndex}
            disabled={busy || !canReplace}
            className="px-5 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {busy ? "Working..." : "Replace & Index"}
          </button>

          <pre className="p-3 rounded bg-gray-100 text-xs overflow-auto">
            {result ? JSON.stringify(result, null, 2) : "—"}
          </pre>
        </section>
      )}

      {tab === "library" && (
        <section className="border rounded p-4 bg-white space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Library ({prefix})</h2>

            <div className="flex items-center gap-2">
              <button
                className="px-4 py-2 rounded border"
                onClick={() => {
                  setBlobs([]);
                  setCursor(null);
                  setHasMore(false);
                  loadLibrary(null);
                }}
                disabled={libBusy || !adminSecret.trim()}
              >
                {libBusy ? "Loading..." : "Refresh"}
              </button>

              {hasMore && (
                <button
                  className="px-4 py-2 rounded border"
                  onClick={() => loadLibrary(cursor)}
                  disabled={libBusy}
                >
                  Next
                </button>
              )}
            </div>
          </div>

          {!adminSecret.trim() && (
            <div className="text-sm text-gray-600">Enter Admin Secret to load the library.</div>
          )}

          {libError && (
            <div className="text-sm text-red-600">{libError}</div>
          )}

          {adminSecret.trim() && !libBusy && blobs.length === 0 && !libError && (
            <div className="text-sm text-gray-600">No files found under {prefix}</div>
          )}

          <ul className="space-y-2">
            {blobs.map((b) => (
              <li key={b.pathname} className="border rounded p-3">
                <div className="font-medium break-all">{b.pathname}</div>
                <div className="text-sm text-gray-700">
                  Size: {Math.round((b.size ?? 0) / 1024)} KB
                  {b.uploadedAt ? ` • Uploaded: ${new Date(b.uploadedAt).toLocaleString()}` : ""}
                  {b.contentType ? ` • ${b.contentType}` : ""}
                </div>
                <a
                  href={b.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm underline break-all"
                >
                  Open
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
