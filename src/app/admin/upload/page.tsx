"use client";

import { useEffect, useState } from "react";

type BlobItem = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
};

export default function AdminUploadPage() {
  const [secret, setSecret] = useState("");
  const [ok, setOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resData, setResData] = useState<Record<string, any> | null>(null);

  const [blobs, setBlobs] = useState<BlobItem[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // ✅ Replace-by-key
  const [key, setKey] = useState("");
  const [prune, setPrune] = useState(true);

  useEffect(() => {
    setOk(false);
  }, []);

  async function verify() {
    setErrorMsg(null);

    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: secret.trim() }),
    });

    if (res.ok) {
      setOk(true);
      await loadBlobs(secret.trim());
      return;
    }

    if (res.status === 401) setErrorMsg("Wrong secret.");
    else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data?.error ?? "Verify failed.");
    }

    setOk(false);
  }

  async function upload() {
    if (!file) return;

    setLoading(true);
    setResData(null);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { "x-admin-secret": secret.trim() },
      body: form,
    });

    const data = await res.json().catch(() => ({}));
    setResData({ status: res.status, ...data });
    setLoading(false);

    if (res.ok) await loadBlobs(secret.trim());
  }

  // ✅ Replace (update) by key
  async function replace() {
    if (!file) return;

    setLoading(true);
    setResData(null);

    const form = new FormData();
    form.append("file", file);
    form.append("key", key.trim());
    form.append("prune", prune ? "true" : "false");

    const res = await fetch("/api/admin/replace", {
      method: "POST",
      headers: { "x-admin-secret": secret.trim() },
      body: form,
    });

    const data = await res.json().catch(() => ({}));
    setResData({ status: res.status, ...data });
    setLoading(false);

    if (res.ok) await loadBlobs(secret.trim());
  }

  async function loadBlobs(s: string) {
    setListLoading(true);

    const res = await fetch("/api/admin/blobs", {
      headers: { "x-admin-secret": s },
    });

    const data = await res.json().catch(() => ({}));
    setListLoading(false);

    if (res.ok && data?.blobs) setBlobs(data.blobs);
  }

  async function deleteBlob(url: string) {
    if (!confirm("Delete this file?")) return;

    const res = await fetch("/api/admin/blob-delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": secret.trim(),
      },
      body: JSON.stringify({ url }),
    });

    if (res.ok) await loadBlobs(secret.trim());
    else alert("Delete failed");
  }

  if (!ok) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md p-5 rounded border bg-white space-y-4">
          <h1 className="text-xl font-semibold">Admin Access</h1>

          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            placeholder="Enter admin secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />

          <button
            className="w-full px-4 py-2 rounded bg-black text-white"
            onClick={verify}
          >
            Enter
          </button>

          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

          <p className="text-sm text-gray-500">
            If you do not have the secret, you cannot access this page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Admin Library</h1>

      {/* Upload + Replace */}
      <section className="p-4 rounded border bg-white space-y-4">
        <h2 className="font-semibold">Upload / Replace PDF</h2>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <input
            className="border rounded px-3 py-2"
            placeholder="key (e.g. fcom_787)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prune}
              onChange={(e) => setPrune(e.target.checked)}
            />
            Delete old versions
          </label>

          <button
            onClick={replace}
            disabled={!file || !key.trim() || loading}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {loading ? "Replacing..." : "Replace (by key)"}
          </button>

          <button
            onClick={upload}
            disabled={!file || loading}
            className="px-4 py-2 rounded border disabled:opacity-50"
          >
            {loading ? "Uploading..." : "Upload (one-off)"}
          </button>

          <button
            onClick={() => loadBlobs(secret.trim())}
            disabled={listLoading}
            className="px-4 py-2 rounded border disabled:opacity-50"
          >
            {listLoading ? "Refreshing..." : "Refresh List"}
          </button>
        </div>

        {resData && (
          <pre className="p-3 rounded bg-gray-100 text-sm overflow-auto">
            {JSON.stringify(resData, null, 2)}
          </pre>
        )}
      </section>

      {/* List */}
      <section className="p-4 rounded border bg-white space-y-4">
        <h2 className="font-semibold">Files</h2>

        {listLoading && <p className="text-sm text-gray-600">Loading...</p>}

        {!listLoading && blobs.length === 0 && (
          <p className="text-sm text-gray-600">No files yet.</p>
        )}

        <div className="space-y-3">
          {blobs.map((b) => (
            <div
              key={b.url}
              className="p-3 rounded border flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="font-medium break-all">{b.pathname}</div>
                <div className="text-sm text-gray-600">
                  {Math.round(b.size / 1024)} KB •{" "}
                  {new Date(b.uploadedAt).toLocaleString()}
                </div>
                <a className="text-sm underline" href={b.url} target="_blank">
                  Open
                </a>
              </div>

              <button
                onClick={() => deleteBlob(b.url)}
                className="px-3 py-2 rounded border"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
