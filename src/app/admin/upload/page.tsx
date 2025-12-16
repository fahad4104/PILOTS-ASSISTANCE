"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

export default function AdminUploadPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [key, setKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function onReplaceAndIndex() {
    setResult(null);

    if (!adminSecret.trim()) {
      setResult({ ok: false, error: "Admin Secret is required" });
      return;
    }
    if (!key.trim()) {
      setResult({ ok: false, error: "Key is required (e.g. fcom_787 / fctm / qrh_777)" });
      return;
    }
    if (!file) {
      setResult({ ok: false, error: "Please choose a PDF file" });
      return;
    }
    if (file.type !== "application/pdf") {
      setResult({ ok: false, error: "Only PDF allowed" });
      return;
    }

    setLoading(true);

    try {
      // 1) Upload directly to Blob (no 413)
      const blob = await upload(`manuals/${key.trim().toLowerCase()}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/blob-upload-token",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
      });

      // 2) Tell server to index using blob.url (JSON صغيرة)
      const res = await fetch("/api/admin/replace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({
          key: key.trim(),
          blobUrl: blob.url,
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      setResult({ step: "index", status: res.status, data, blob });
    } catch (e: any) {
      setResult({ ok: false, error: String(e?.message ?? e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin Library</h1>

      <section className="border rounded p-4 bg-white space-y-4">
        <h2 className="font-semibold">Replace PDF (Single File)</h2>

        <div className="space-y-2">
          <label className="text-sm text-gray-600">Admin Secret</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="Enter ADMIN_SECRET"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-600">Choose File (PDF)</label>
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

        <div className="space-y-2">
          <label className="text-sm text-gray-600">Key (e.g. fcom_787 / fctm / qrh_777)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="fcom_787"
          />
        </div>

        <button
          onClick={onReplaceAndIndex}
          disabled={loading}
          className="px-5 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {loading ? "Working..." : "Replace & Index"}
        </button>

        <pre className="p-3 rounded bg-gray-100 text-xs overflow-auto">
          {result ? JSON.stringify(result, null, 2) : "—"}
        </pre>
      </section>
    </main>
  );
}
