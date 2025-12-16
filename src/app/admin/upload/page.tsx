"use client";

import { useEffect, useMemo, useState } from "react";

type BlobItem = {
  pathname: string;
  url: string;
  size: number;
  uploadedAt?: string | null;
};

function tryParseJson(text: string) {
  try {
    return { ok: true as const, json: JSON.parse(text) };
  } catch {
    return { ok: false as const, json: null };
  }
}

export default function AdminUploadPage() {
  const [tab, setTab] = useState<"upload" | "library">("upload");

  const [adminSecret, setAdminSecret] = useState("");

  // ===== Upload state =====
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState("");
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  // ===== Library state =====
  const [prefix, setPrefix] = useState("manuals/");
  const [items, setItems] = useState<BlobItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");

  const totalSize = useMemo(
    () => items.reduce((a, b) => a + (b.size || 0), 0),
    [items]
  );

  function formatBytes(bytes: number) {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
  }

  // ================= UPLOAD =================
  async function replaceAndIndex() {
    if (!file) {
      setUploadResult({ error: "No file selected" });
      return;
    }
    if (!key.trim()) {
      setUploadResult({ error: "Key is required" });
      return;
    }
    if (!adminSecret.trim()) {
      setUploadResult({ error: "Admin Secret is required" });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("key", key.trim());

      const res = await fetch("/api/admin/replace", {
        method: "POST",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
        body: form,
      });

      const text = await res.text();
      const ct = res.headers.get("content-type") || "";
      const parsed = tryParseJson(text);

      // إذا رجع JSON نعرضه، وإذا رجع نص نعرض النص الخام
      const payload =
        ct.includes("application/json") && parsed.ok
          ? parsed.json
          : { nonJson: true, raw: text };

      setUploadResult({ status: res.status, data: payload });

      if (res.ok && !(payload as any)?.nonJson) {
        await loadLibrary();
        setTab("library");
      }
    } catch (e: any) {
      setUploadResult({ error: String(e?.message ?? e) });
    } finally {
      setUploading(false);
    }
  }

  // ================= LIBRARY =================
  async function loadLibrary() {
    if (!adminSecret.trim()) return;

    setLoadingList(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/blobs?prefix=${encodeURIComponent(prefix)}`,
        {
          headers: {
            "x-admin-secret": adminSecret.trim(),
          },
        }
      );

      const text = await res.text();
      const parsed = tryParseJson(text);

      if (!res.ok) {
        setError(
          parsed.ok ? parsed.json?.error || "Failed to load files" : text
        );
        setItems([]);
        return;
      }

      const data = parsed.ok ? parsed.json : null;
      if (!data?.ok) {
        setError(data?.error || "Failed to load files");
        setItems([]);
        return;
      }

      setItems(data.items || []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }

  async function deleteFile(it: BlobItem) {
    if (!confirm(`Delete this file?\n\n${it.pathname}`)) return;

    try {
      const res = await fetch("/api/admin/blob-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ url: it.url }),
      });

      if (!res.ok) {
        const t = await res.text();
        alert(`Delete failed: ${t}`);
        return;
      }

      setItems((prev) => prev.filter((x) => x.url !== it.url));
    } catch {
      alert("Delete failed");
    }
  }

  useEffect(() => {
    if (tab === "library" && adminSecret.trim()) {
      loadLibrary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin Library</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("upload")}
          className={`px-4 py-2 rounded border ${
            tab === "upload" ? "bg-black text-white" : ""
          }`}
        >
          Upload PDF
        </button>
        <button
          onClick={() => setTab("library")}
          className={`px-4 py-2 rounded border ${
            tab === "library" ? "bg-black text-white" : ""
          }`}
        >
          Library
        </button>
      </div>

      <div className="border rounded p-4 bg-white space-y-2">
        <label className="text-sm font-medium">Admin Secret</label>
        <input
          type="password"
          className="w-full border rounded px-3 py-2"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
        />
      </div>

      {tab === "upload" && (
        <section className="border rounded p-4 bg-white space-y-4">
          <h2 className="font-semibold">Replace PDF (Single File)</h2>

          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Key (e.g. fcom_787 / fctm / qrh_777)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />

          <button
            onClick={replaceAndIndex}
            disabled={uploading || !file || !key.trim() || !adminSecret.trim()}
            className="px-5 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Replace & Index"}
          </button>

          {uploadResult && (
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
              {JSON.stringify(uploadResult, null, 2)}
            </pre>
          )}
        </section>
      )}

      {tab === "library" && (
        <section className="border rounded p-4 bg-white space-y-4">
          <h2 className="font-semibold">Stored Files</h2>

          <div className="flex gap-2 flex-wrap">
            <input
              className="flex-1 min-w-[240px] border rounded px-3 py-2"
              placeholder="Prefix (default manuals/)"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
            />
            <button
              onClick={loadLibrary}
              disabled={!adminSecret.trim() || loadingList}
              className="px-4 py-2 rounded border bg-black text-white disabled:opacity-50"
            >
              {loadingList ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div className="text-sm">
            Files: <b>{items.length}</b> • Total size:{" "}
            <b>{formatBytes(totalSize)}</b>
          </div>

          {error && <div className="text-red-600">{error}</div>}

          {items.length === 0 ? (
            <div className="text-sm text-gray-600">No files found.</div>
          ) : (
            <table className="w-full text-sm border">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">File</th>
                  <th className="p-2">Size</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.url} className="border-b">
                    <td className="p-2 break-all">{it.pathname}</td>
                    <td className="p-2">{formatBytes(it.size)}</td>
                    <td className="p-2 flex gap-3">
                      <a href={it.url} target="_blank" className="underline">
                        Open
                      </a>
                      <button
                        onClick={() => deleteFile(it)}
                        className="text-red-600 underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  );
}
