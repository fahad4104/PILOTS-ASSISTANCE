"use client";

import { useEffect, useMemo, useState } from "react";

type BlobItem = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt?: string;
};

export default function AdminUploadPage() {
  const [tab, setTab] = useState<"upload" | "library">("upload");

  const [adminSecret, setAdminSecret] = useState("");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState("fcom_787");
  const [deleteOld, setDeleteOld] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  // Library state
  const [prefix, setPrefix] = useState("manuals/");
  const [items, setItems] = useState<BlobItem[]>([]);
  const [libBusy, setLibBusy] = useState(false);
  const [libErr, setLibErr] = useState<string | null>(null);

  const canAdmin = useMemo(() => adminSecret.trim().length > 0, [adminSecret]);

  async function replaceAndIndex() {
    setBusy(true);
    setResult(null);

    try {
      if (!canAdmin) throw new Error("Admin secret required");
      if (!file) throw new Error("Please choose a PDF file");

      // 1) ارفع الملف الى blob عبر endpoint عندك
      const fd = new FormData();
      fd.append("file", file);

      const up = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "x-admin-secret": adminSecret.trim() },
        body: fd,
      });

      const upText = await up.text();
      let upData: any = {};
      try {
        upData = upText ? JSON.parse(upText) : {};
      } catch {
        upData = { nonJson: true, raw: upText };
      }

      if (!up.ok || upData?.ok === false) {
        setResult({ step: "upload", ok: false, status: up.status, data: upData });
        setBusy(false);
        return;
      }

      const blobUrl = upData?.url;
      if (!blobUrl) throw new Error("Upload returned no url");

      // 2) بعدها index/replace عبر endpoint عندك
      const rep = await fetch("/api/admin/replace", {
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

      const repText = await rep.text();
      let repData: any = {};
      try {
        repData = repText ? JSON.parse(repText) : {};
      } catch {
        repData = { nonJson: true, raw: repText };
      }

      setResult({
        step: "index",
        ok: rep.ok && repData?.ok !== false,
        status: rep.status,
        data: repData,
        blob: {
          url: upData?.url,
          pathname: upData?.pathname,
          size: upData?.size,
        },
      });

      // تحديث المكتبة بعد نجاح الرفع
      if (rep.ok) {
        await refreshLibrary();
        setTab("library");
      }
    } catch (e: any) {
      setResult({ step: "client", ok: false, error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

  async function refreshLibrary() {
    setLibBusy(true);
    setLibErr(null);
    try {
      if (!canAdmin) throw new Error("Admin secret required");

      const res = await fetch(`/api/admin/blobs?prefix=${encodeURIComponent(prefix)}`, {
        headers: { "x-admin-secret": adminSecret.trim() },
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { nonJson: true, raw: text };
      }

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `List failed (${res.status})`);
      }

      setItems(Array.isArray(data?.blobs) ? data.blobs : []);
    } catch (e: any) {
      setLibErr(String(e?.message ?? e));
      setItems([]);
    } finally {
      setLibBusy(false);
    }
  }

  async function deleteBlob(it: BlobItem) {
    if (!canAdmin) return;

    const ok = confirm(`Delete this file?\n\n${it.pathname}`);
    if (!ok) return;

    try {
      setLibBusy(true);
      const res = await fetch("/api/admin/blob-delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ url: it.url, pathname: it.pathname }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { nonJson: true, raw: text };
      }

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Delete failed (${res.status})`);
      }

      // تحديث القائمة محلياً بسرعة
      setItems((prev) => prev.filter((x) => x.pathname !== it.pathname));
    } catch (e: any) {
      alert(String(e?.message ?? e));
    } finally {
      setLibBusy(false);
    }
  }

  useEffect(() => {
    if (tab === "library" && canAdmin) {
      refreshLibrary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Library</h1>

      <div className="flex gap-2">
        <button
          className={`px-4 py-2 border rounded ${tab === "upload" ? "bg-black text-white" : ""}`}
          onClick={() => setTab("upload")}
        >
          Upload PDF
        </button>
        <button
          className={`px-4 py-2 border rounded ${tab === "library" ? "bg-black text-white" : ""}`}
          onClick={() => setTab("library")}
        >
          Library
        </button>
      </div>

      <div className="border rounded p-4 space-y-2">
        <label className="block text-sm font-medium">Admin Secret</label>
        <input
          type="password"
          className="w-full border rounded p-2"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          placeholder="Enter admin secret"
        />
      </div>

      {tab === "upload" && (
        <section className="border rounded p-4 space-y-4">
          <h2 className="text-xl font-semibold">Replace PDF (Single File)</h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Choose File (PDF)</label>
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
            <label className="block text-sm font-medium">Key (e.g. fcom_787 / fctm / qrh_777)</label>
            <input
              className="w-full border rounded p-2"
              value={key}
              onChange={(e) => setKey(e.target.value)}
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
            className="px-5 py-2 rounded bg-black text-white disabled:opacity-50"
            onClick={replaceAndIndex}
            disabled={busy || !canAdmin || !file || !key.trim()}
          >
            {busy ? "Working..." : "Replace & Index"}
          </button>

          <pre className="p-3 rounded bg-gray-100 text-xs overflow-auto">
            {result ? JSON.stringify(result, null, 2) : "—"}
          </pre>
        </section>
      )}

      {tab === "library" && (
        <section className="border rounded p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-semibold">Library ({prefix})</h2>
            <button
              className="px-4 py-2 border rounded"
              onClick={refreshLibrary}
              disabled={libBusy || !canAdmin}
            >
              {libBusy ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div className="flex gap-2 items-end flex-wrap">
            <div className="space-y-1">
              <label className="block text-sm font-medium">Prefix</label>
              <input
                className="border rounded p-2 w-[260px]"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
              />
            </div>
            <button
              className="px-4 py-2 border rounded"
              onClick={refreshLibrary}
              disabled={libBusy || !canAdmin}
            >
              Apply
            </button>
          </div>

          {libErr && <div className="text-sm text-red-600">{libErr}</div>}

          {items.length === 0 ? (
            <div className="text-sm text-gray-600">No files found.</div>
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.pathname} className="border rounded p-3">
                  <div className="font-medium">{it.pathname}</div>
                  <div className="text-sm text-gray-600">
                    Size: {Math.round(it.size / 1024)} KB
                    {it.uploadedAt ? ` • Uploaded: ${new Date(it.uploadedAt).toLocaleString()}` : ""}
                  </div>

                  <div className="flex gap-3 mt-2">
                    <a className="underline text-sm" href={it.url} target="_blank" rel="noreferrer">
                      Open
                    </a>

                    <button
                      className="text-sm underline"
                      onClick={() => deleteBlob(it)}
                      disabled={libBusy || !canAdmin}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
