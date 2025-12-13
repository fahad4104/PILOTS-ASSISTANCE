"use client";

import { useEffect, useMemo, useState } from "react";

type BlobItem = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
};

type BatchItem = {
  file: File;
  key: string;
  status: "idle" | "uploading" | "done" | "error";
  result?: any;
};

function normalizeKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

function suggestKeyFromFilename(name: string) {
  // 787_FCOM.pdf => fcom_787 (لو تبي عكسها عدّل)
  const base = name.replace(/\.pdf$/i, "");
  const s = base.toLowerCase();

  // قواعد بسيطة قابلة للتعديل
  const has787 = /787/.test(s);
  const has777 = /777/.test(s);

  let type = "";
  if (/(fcom)/.test(s)) type = "fcom";
  else if (/(fctm)/.test(s)) type = "fctm";
  else if (/(qrh)/.test(s)) type = "qrh";
  else if (/(mel)/.test(s)) type = "mel";
  else if (/(oma|om-a)/.test(s)) type = "oma";
  else if (/(omb|om-b)/.test(s)) type = "omb";
  else type = "manual";

  let ac = has787 ? "787" : has777 ? "777" : "";
  return normalizeKey(ac ? `${type}_${ac}` : type);
}

export default function AdminUploadPage() {
  const [secret, setSecret] = useState("");
  const [ok, setOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [blobs, setBlobs] = useState<BlobItem[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [deleteOld, setDeleteOld] = useState(true);

  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);

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

  async function loadBlobs(s: string) {
    setListLoading(true);
    const res = await fetch("/api/admin/blobs", {
      headers: { "x-admin-secret": s },
    });
    const data = await res.json().catch(() => ({}));
    setListLoading(false);

    if (res.ok && data?.blobs) setBlobs(data.blobs);
  }

  function onPickFiles(files: FileList | null) {
    if (!files) return;

    const items: BatchItem[] = Array.from(files)
      .filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name))
      .map((f) => ({
        file: f,
        key: suggestKeyFromFilename(f.name),
        status: "idle",
      }));

    setBatch(items);
  }

  function updateKey(idx: number, key: string) {
    setBatch((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, key: normalizeKey(key) } : it))
    );
  }

  async function replaceOne(item: BatchItem) {
    const form = new FormData();
    form.append("file", item.file);
    form.append("key", item.key);
    // نرسل deleteOld كـ flag (لو ما تستخدمه بالسيرفر حالياً ما يأثر)
    form.append("deleteOld", deleteOld ? "1" : "0");

    const res = await fetch("/api/admin/replace", {
      method: "POST",
      headers: { "x-admin-secret": secret.trim() },
      body: form,
    });

    const dataText = await res.text();
    let data: any;
    try {
      data = JSON.parse(dataText);
    } catch {
      data = { raw: dataText };
    }

    return { httpStatus: res.status, data };
  }

  async function runBatch() {
    if (running) return;
    setRunning(true);

    // ارفع واحد وراء الثاني لتجنب ضغط الشبكة + تجنب timeouts
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      if (!item.key) {
        setBatch((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "error", result: { error: "Missing key" } } : it
          )
        );
        continue;
      }

      setBatch((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "uploading" } : it))
      );

      try {
        const result = await replaceOne(item);
        const ok = result.httpStatus >= 200 && result.httpStatus < 300;

        setBatch((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: ok ? "done" : "error", result }
              : it
          )
        );
      } catch (e: any) {
        setBatch((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: "error", result: { error: String(e?.message ?? e) } }
              : it
          )
        );
      }
    }

    await loadBlobs(secret.trim());
    setRunning(false);
  }

  const summary = useMemo(() => {
    const total = batch.length;
    const done = batch.filter((b) => b.status === "done").length;
    const err = batch.filter((b) => b.status === "error").length;
    return { total, done, err };
  }, [batch]);

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
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Admin Library</h1>

      {/* Batch Upload */}
      <section className="p-4 rounded border bg-white space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold">Upload / Replace PDFs (Batch)</h2>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={deleteOld}
              onChange={(e) => setDeleteOld(e.target.checked)}
            />
            Delete old versions (UI flag)
          </label>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={(e) => onPickFiles(e.target.files)}
          />

          <button
            onClick={runBatch}
            disabled={running || batch.length === 0}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {running ? `Uploading... (${summary.done}/${summary.total})` : "Start Batch Replace"}
          </button>

          <button
            onClick={() => loadBlobs(secret.trim())}
            disabled={listLoading}
            className="px-4 py-2 rounded border disabled:opacity-50"
          >
            {listLoading ? "Refreshing..." : "Refresh List"}
          </button>
        </div>

        {batch.length > 0 && (
          <div className="border rounded">
            <div className="grid grid-cols-12 gap-2 p-2 text-xs font-semibold bg-gray-50">
              <div className="col-span-5">File</div>
              <div className="col-span-3">Key</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Result</div>
            </div>

            {batch.map((b, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 p-2 border-t text-sm items-center">
                <div className="col-span-5 truncate" title={b.file.name}>
                  {b.file.name}
                </div>

                <div className="col-span-3">
                  <input
                    className="w-full border rounded px-2 py-1"
                    value={b.key}
                    onChange={(e) => updateKey(idx, e.target.value)}
                    placeholder="e.g. fcom_787"
                  />
                </div>

                <div className="col-span-2">
                  {b.status === "idle" && "Ready"}
                  {b.status === "uploading" && "Uploading..."}
                  {b.status === "done" && "Done"}
                  {b.status === "error" && "Error"}
                </div>

                <div className="col-span-2">
                  {b.result ? (
                    <span className="text-xs">
                      {b.result?.data?.data?.ok || b.result?.data?.ok ? "OK" : "View"}
                    </span>
                  ) : (
                    "-"
                  )}
                </div>

                {b.result && (
                  <div className="col-span-12">
                    <pre className="p-2 rounded bg-gray-100 text-xs overflow-auto">
                      {JSON.stringify(b.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Files list */}
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
                onClick={async () => {
                  if (!confirm("Delete this file?")) return;
                  const res = await fetch("/api/admin/blob-delete", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-admin-secret": secret.trim(),
                    },
                    body: JSON.stringify({ url: b.url }),
                  });
                  if (res.ok) await loadBlobs(secret.trim());
                  else alert("Delete failed");
                }}
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
