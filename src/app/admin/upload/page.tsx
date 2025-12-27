"use client";

import { useEffect, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";

type Tab = "upload" | "library" | "vector";

type ManualItem = {
  id: string;
  key: string;
  originalName: string;
  blobUrl: string;
  blobPathname: string;
  openaiFileId: string;
  createdAt: string;
};

// ✅ هذا الشكل يطابق اللي راجع من /api/admin/vectorstore/list عندك
type VectorStoreFileItem = {
  vs_file_id: string; // vector_store_file_id (هذا اللي نحذفه من VS)
  openai_file_id?: string; // OpenAI file id (للحذف النهائي)
  filename?: string;
  bytes?: number;
  created_at?: number; // seconds
  status?: string;
  [k: string]: any;
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

  // library state (DB Manuals)
  const [loadingLib, setLoadingLib] = useState(false);
  const [items, setItems] = useState<ManualItem[]>([]);
  const [libError, setLibError] = useState<string | null>(null);

  // vector store state
  const [loadingVS, setLoadingVS] = useState(false);
  const [vsError, setVsError] = useState<string | null>(null);
  const [vsFiles, setVsFiles] = useState<VectorStoreFileItem[]>([]);

  const prefix = useMemo(() => "manuals/", []);

  async function refreshLibrary() {
    setLoadingLib(true);
    setLibError(null);

    if (!adminSecret.trim()) {
      setLibError("Admin Secret required to load library");
      setItems([]);
      setLoadingLib(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/manuals/list", {
        method: "GET",
        cache: "no-store",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
      });

      const text = await res.text();
      const data = safeJson(text);

      if (!res.ok || !data?.ok) {
        setLibError((data as any)?.error || (data as any)?.raw || `Failed (${res.status})`);
        setItems([]);
        return;
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setLibError(String(e?.message ?? e));
      setItems([]);
    } finally {
      setLoadingLib(false);
    }
  }

  async function refreshVectorStore() {
    setLoadingVS(true);
    setVsError(null);

    if (!adminSecret.trim()) {
      setVsError("Admin Secret required to load vector store files");
      setVsFiles([]);
      setLoadingVS(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/vectorstore/list", {
        method: "GET",
        cache: "no-store",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
      });

      const text = await res.text();
      const data = safeJson(text);

      if (!res.ok || !data?.ok) {
        setVsError((data as any)?.error || (data as any)?.raw || `Failed (${res.status})`);
        setVsFiles([]);
        setResult(data);
        return;
      }

      const list = Array.isArray(data?.files)
        ? data.files
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setVsFiles(list);
      setResult(data);
    } catch (e: any) {
      setVsError(String(e?.message ?? e));
      setVsFiles([]);
    } finally {
      setLoadingVS(false);
    }
  }

  async function clearVectorStore(deleteFilesToo: boolean) {
    if (!adminSecret.trim()) {
      setResult({ ok: false, error: "Admin Secret required" });
      return;
    }

    const yes = confirm(
      deleteFilesToo
        ? "Clear vector store AND delete the files from OpenAI too?\nThis is destructive."
        : "Clear vector store only?\n(Does not delete OpenAI files)"
    );
    if (!yes) return;

    setBusy(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/vectorstore/clear", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ deleteFilesToo }),
      });

      const text = await res.text();
      const data = safeJson(text);

      if (!res.ok || !data?.ok) {
        setResult({ ok: false, step: "vectorstore_clear", status: res.status, ...data });
        return;
      }

      setResult({ ok: true, step: "vectorstore_clear", status: res.status, ...data });
      await refreshVectorStore();
    } catch (e: any) {
      setResult({ ok: false, step: "vectorstore_clear", error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

  // ✅ NEW: delete one VS file (detach only OR detach+delete OpenAI file)
  async function deleteOneVSFile(vsFileId: string, deleteFileToo: boolean) {
    if (!adminSecret.trim()) {
      setResult({ ok: false, error: "Admin Secret required" });
      return;
    }
    if (!vsFileId) {
      setResult({ ok: false, error: "Missing vs_file_id" });
      return;
    }

    const msg = deleteFileToo
      ? `Delete this item from Vector Store AND delete OpenAI file?\n\nvs_file_id: ${vsFileId}\n\nThis is destructive.`
      : `Detach this item from Vector Store only?\n\nvs_file_id: ${vsFileId}`;

    const yes = confirm(msg);
    if (!yes) return;

    setBusy(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/vectorstore/delete", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ vs_file_id: vsFileId, deleteFileToo }),
      });

      const text = await res.text();
      const data = safeJson(text);

      if (!res.ok || data?.ok === false) {
        setResult({ ok: false, step: "vectorstore_delete_one", status: res.status, ...data });
        return;
      }

      setResult({ ok: true, step: "vectorstore_delete_one", status: res.status, ...data });
      await refreshVectorStore();
    } catch (e: any) {
      setResult({ ok: false, step: "vectorstore_delete_one", error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (tab === "library") refreshLibrary();
    if (tab === "vector") refreshVectorStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    setBlobUrl("");
    setBlobPathname("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, key]);

  async function deleteManualEverywhere(manualKey: string) {
    if (!adminSecret.trim()) {
      setResult({ ok: false, error: "Admin Secret required to delete" });
      return;
    }

    const yes = confirm(`Delete from ALL places?\nkey: ${manualKey}`);
    if (!yes) return;

    setBusy(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/manuals/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ key: manualKey }),
      });

      const text = await res.text();
      const data = safeJson(text);

      if (!res.ok || !data?.ok) {
        setResult({ ok: false, step: "manual_delete", status: res.status, ...data });
        return;
      }

      setResult({ ok: true, step: "manual_delete", status: res.status, ...data });
      await refreshLibrary();
    } catch (e: any) {
      setResult({ ok: false, step: "manual_delete", error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

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
      const pathname = `${prefix}${key.trim().toLowerCase()}/${ts}-${safeName}`;

      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/admin/blob-upload-token",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
        clientPayload: JSON.stringify({ key: key.trim().toLowerCase() }),
      });

      setBlobUrl(blob.url);
      setBlobPathname(blob.pathname);

      setResult({ ok: true, step: "blob_upload", blob });

      if (tab === "library") await refreshLibrary();
    } catch (e: any) {
      setResult({ ok: false, step: "blob_upload", error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

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
          key: key.trim().toLowerCase(),
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
      if (tab === "vector") await refreshVectorStore();
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
          DB Library
        </button>

        <button
          className={`px-4 py-2 rounded border ${tab === "vector" ? "bg-black text-white" : "bg-white"}`}
          onClick={() => setTab("vector")}
        >
          Vector Store
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

        {tab === "library" && (
          <div className="mt-2 text-xs text-gray-600">
            DB Library يقرأ من SQLite (Manuals). هذا ليس مصدر الإجابة في /ask.
          </div>
        )}

        {tab === "vector" && (
          <div className="mt-2 text-xs text-gray-600">
            Vector Store هو المصدر الفعلي للإجابات في /ask (file_search). هنا تشوف فعليًا الكتب المرفوعة للـ Vector Store.
          </div>
        )}
      </section>

      {tab === "upload" && (
        <section className="border rounded p-4 space-y-4">
          <h2 className="text-xl font-semibold">Replace PDF (Direct to Blob)</h2>

          <div className="space-y-1">
            <label className="block text-sm font-medium">Choose File (PDF)</label>
            <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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
            <h2 className="text-xl font-semibold">DB Library (Manuals table)</h2>
            <button className="px-4 py-2 rounded border" onClick={refreshLibrary} disabled={loadingLib}>
              {loadingLib ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {libError && <div className="text-sm text-red-600">{libError}</div>}

          <div className="space-y-3">
            {items.length === 0 && !loadingLib ? (
              <div className="text-sm text-gray-600">No manuals found in DB.</div>
            ) : (
              items.map((m) => (
                <div key={m.id} className="border rounded p-3">
                  <div className="font-mono text-sm">key: {m.key}</div>
                  <div className="text-sm text-gray-600">
                    {m.originalName} • {m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}
                  </div>

                  <div className="mt-2 text-xs font-mono break-all text-gray-600">{m.blobPathname}</div>

                  <div className="flex items-center gap-3 mt-3">
                    <a className="text-sm underline" href={m.blobUrl} target="_blank" rel="noreferrer">
                      Open PDF
                    </a>

                    <button
                      className="text-sm px-3 py-1 rounded border"
                      onClick={() => deleteManualEverywhere(m.key)}
                      disabled={busy}
                    >
                      Delete (everywhere)
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border rounded p-3 bg-gray-50">
            <pre className="text-xs overflow-auto">{JSON.stringify(result ?? {}, null, 2)}</pre>
          </div>
        </section>
      )}

      {tab === "vector" && (
        <section className="border rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Vector Store Files</h2>

            <div className="flex items-center gap-2">
              <button className="px-4 py-2 rounded border" onClick={refreshVectorStore} disabled={loadingVS}>
                {loadingVS ? "Loading..." : "List Vector Store Files"}
              </button>

              <button className="px-4 py-2 rounded border" onClick={() => clearVectorStore(false)} disabled={busy}>
                Clear VS (detach only)
              </button>

              <button className="px-4 py-2 rounded border" onClick={() => clearVectorStore(true)} disabled={busy}>
                Clear VS + Delete Files
              </button>
            </div>
          </div>

          {vsError && <div className="text-sm text-red-600">{vsError}</div>}

          <div className="space-y-3">
            {vsFiles.length === 0 && !loadingVS ? (
              <div className="text-sm text-gray-600">No files found in Vector Store (or endpoint returned empty).</div>
            ) : (
              vsFiles.map((f) => {
                const vsId = String(f?.vs_file_id || "").trim();
                const openaiId = String(f?.openai_file_id || "").trim();

                return (
                  <div key={vsId || openaiId || Math.random().toString(36)} className="border rounded p-3">
                    <div className="font-mono text-sm break-all">vs_file_id: {vsId || "—"}</div>
                    <div className="font-mono text-xs break-all text-gray-600">openai_file_id: {openaiId || "—"}</div>

                    <div className="text-sm text-gray-600 mt-1">
                      {f.filename ? `Name: ${f.filename}` : "Name: —"}{" "}
                      {typeof f.bytes === "number" ? `• Size: ${Math.round(f.bytes / 1024)} KB` : ""}
                      {typeof f.created_at === "number"
                        ? ` • Created: ${new Date(f.created_at * 1000).toLocaleString()}`
                        : ""}
                      {f.status ? ` • Status: ${f.status}` : ""}
                    </div>

                    {/* ✅ NEW: per-file delete buttons */}
                    <div className="flex items-center gap-3 mt-3">
                      <button
                        className="text-sm px-3 py-1 rounded border"
                        disabled={busy || !vsId}
                        onClick={() => deleteOneVSFile(vsId, false)}
                      >
                        Delete (detach only)
                      </button>

                      <button
                        className="text-sm px-3 py-1 rounded border"
                        disabled={busy || !vsId}
                        onClick={() => deleteOneVSFile(vsId, true)}
                      >
                        Delete (detach + OpenAI file)
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border rounded p-3 bg-gray-50">
            <pre className="text-xs overflow-auto">{JSON.stringify(result ?? {}, null, 2)}</pre>
          </div>

          <div className="text-xs text-gray-600">
            ملاحظة: المصدر الحقيقي لـ /ask هو Vector Store. DB Library مجرد سجل عندك.
          </div>
        </section>
      )}
    </main>
  );
}
