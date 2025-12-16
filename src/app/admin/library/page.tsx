"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type BlobItem = {
  pathname: string;
  url: string;
  downloadUrl?: string;
  size: number;
  uploadedAt?: string | null;
  contentType?: string | null;
};

export default function AdminLibraryPage() {
  const [secret, setSecret] = useState("");
  const [prefix, setPrefix] = useState("manuals/");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BlobItem[]>([]);
  const [error, setError] = useState<string>("");

  const totalSize = useMemo(() => items.reduce((a, b) => a + (b.size || 0), 0), [items]);

  function formatBytes(bytes: number) {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
  }

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/blobs?prefix=${encodeURIComponent(prefix)}`, {
        headers: { "x-admin-secret": secret },
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok || data?.ok === false) {
        setItems([]);
        setError(data?.error || `Failed (${res.status})`);
        return;
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function deleteOne(it: BlobItem) {
    if (!confirm(`Delete this file?\n\n${it.pathname}`)) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/blob-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ url: it.url }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok || data?.ok === false) {
        setError(data?.error || `Delete failed (${res.status})`);
        return;
      }

      // remove locally
      setItems((prev) => prev.filter((x) => x.url !== it.url));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // اختياري: ما نسوي auto refresh بدون secret
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Admin Library</h1>
        <div className="flex items-center gap-3">
          <Link className="text-sm underline" href="/admin/upload">
            Upload
          </Link>
          <Link className="text-sm underline" href="/ask">
            Ask Page
          </Link>
        </div>
      </div>

      <section className="border rounded p-4 bg-white space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="text-sm font-medium">Admin Secret</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2 mt-1"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter ADMIN_SECRET"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Prefix (folder)</label>
            <input
              className="w-full border rounded px-3 py-2 mt-1"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="manuals/"
            />
          </div>
        </div>

        <button
          onClick={refresh}
          disabled={loading || !secret.trim()}
          className="px-5 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="text-sm text-gray-700">
          Files: <b>{items.length}</b> • Total size: <b>{formatBytes(totalSize)}</b>
        </div>
      </section>

      <section className="border rounded p-4 bg-white">
        {items.length === 0 ? (
          <div className="text-sm text-gray-600">No files found.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">Pathname</th>
                  <th className="py-2 pr-3">Size</th>
                  <th className="py-2 pr-3">Uploaded</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.url} className="border-b align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{it.pathname}</div>
                      <div className="text-xs text-gray-600 break-all">{it.url}</div>
                    </td>
                    <td className="py-2 pr-3">{formatBytes(it.size)}</td>
                    <td className="py-2 pr-3">
                      {it.uploadedAt ? new Date(it.uploadedAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2 flex-wrap">
                        <a
                          className="underline"
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                        <button
                          onClick={() => deleteOne(it)}
                          className="underline text-red-600"
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
