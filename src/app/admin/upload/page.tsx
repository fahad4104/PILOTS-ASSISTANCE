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
  const [authorized, setAuthorized] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState("");
  const [deleteOld, setDeleteOld] = useState(true);

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  const [blobs, setBlobs] = useState<BlobItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  async function verify() {
    setErrorMsg(null);

    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });

    if (res.ok) {
      setAuthorized(true);
      await loadBlobs(secret);
    } else {
      setAuthorized(false);
      setErrorMsg("Wrong ADMIN_SECRET");
    }
  }

  async function loadBlobs(sec: string) {
    setLoadingList(true);
    const res = await fetch("/api/admin/blobs", {
      headers: { "x-admin-secret": sec },
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) setBlobs(data.blobs || []);
    setLoadingList(false);
  }

  async function replace() {
    if (!file || !key.trim()) {
      alert("Choose a PDF and enter a key");
      return;
    }

    setLoading(true);
    setResponse(null);

    const form = new FormData();
    form.append("file", file);
    form.append("key", key.trim());
    form.append("delete_old", deleteOld ? "1" : "0");

    const res = await fetch("/api/admin/replace", {
      method: "POST",
      headers: { "x-admin-secret": secret },
      body: form,
    });

    const data = await res.json().catch(() => ({}));
    setResponse({ status: res.status, ...data });
    setLoading(false);

    await loadBlobs(secret);
  }

  async function deleteBlob(url: string) {
    if (!confirm("Delete this file?")) return;

    await fetch("/api/admin/blob-delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": secret,
      },
      body: JSON.stringify({ url }),
    });

    await loadBlobs(secret);
  }

  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white border rounded p-5 w-full max-w-sm space-y-4">
          <h1 className="text-xl font-semibold">Admin Access</h1>

          <input
            type="password"
            placeholder="ADMIN_SECRET"
            className="w-full border rounded px-3 py-2"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />

          <button
            onClick={verify}
            className="w-full bg-black text-white rounded py-2"
          >
            Enter
          </button>

          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Admin Library</h1>

      {/* Upload */}
      <section className="border rounded p-4 bg-white space-y-4">
        <h2 className="font-semibold">Replace PDF (Single File)</h2>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="Key (example: fcom_787)"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={deleteOld}
            onChange={(e) => setDeleteOld(e.target.checked)}
          />
          Delete old versions
        </label>

        <button
          onClick={replace}
          disabled={loading}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Replace & Index"}
        </button>

        {response && (
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
            {JSON.stringify(response, null, 2)}
          </pre>
        )}
      </section>

      {/* Files */}
      <section className="border rounded p-4 bg-white space-y-4">
        <h2 className="font-semibold">Files</h2>

        {loadingList && <p className="text-sm">Loading…</p>}

        {!loadingList && blobs.length === 0 && (
          <p className="text-sm text-gray-600">No files</p>
        )}

        {blobs.map((b) => (
          <div
            key={b.url}
            className="border rounded p-3 flex justify-between items-start"
          >
            <div>
              <div className="break-all font-medium">{b.pathname}</div>
              <div className="text-sm text-gray-600">
                {Math.round(b.size / 1024)} KB •{" "}
                {new Date(b.uploadedAt).toLocaleString()}
              </div>
              <a href={b.url} target="_blank" className="underline text-sm">
                Open
              </a>
            </div>

            <button
              onClick={() => deleteBlob(b.url)}
              className="border rounded px-3 py-1"
            >
              Delete
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}
