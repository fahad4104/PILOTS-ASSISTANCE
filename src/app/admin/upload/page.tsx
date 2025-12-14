"use client";

import { useMemo, useState } from "react";

type Result = any;

export default function AdminUploadPage() {
  const [secret, setSecret] = useState("");
  const [key, setKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [deleteOld, setDeleteOld] = useState(true);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const canSubmit = useMemo(() => {
    return Boolean(secret.trim() && key.trim() && file);
  }, [secret, key, file]);

  async function uploadAndReplace() {
    setLoading(true);
    setResult(null);

    try {
      // 1) Upload to Blob via your upload route (multipart)
      const fd = new FormData();
      fd.append("file", file as File);
      fd.append("key", key.trim());
      fd.append("deleteOldVersions", String(deleteOld));

      const up = await fetch("/api/admin/upload", {
        method: "POST",
        headers: {
          "x-admin-secret": secret.trim(),
        },
        body: fd,
      });

      const upText = await up.text();
      const upJson = upText ? JSON.parse(upText) : {};

      if (!up.ok || upJson?.ok === false) {
        setResult({ step: "upload", status: up.status, data: upJson });
        setLoading(false);
        return;
      }

      const blobUrl =
        upJson?.newBlobUrl || upJson?.blobUrl || upJson?.url || "";
      if (!blobUrl) {
        setResult({
          step: "upload",
          status: up.status,
          error: "Upload succeeded but no blob url returned",
          data: upJson,
        });
        setLoading(false);
        return;
      }

      // 2) Call replace route using JSON (no PDF in this request)
      const rep = await fetch("/api/admin/replace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret.trim(),
        },
        body: JSON.stringify({
          key: key.trim(),
          blobUrl,
          deleteOldVersions: deleteOld,
        }),
      });

      const repText = await rep.text();
      const repJson = repText ? JSON.parse(repText) : {};

      setResult({
        step: "replace",
        upload: upJson,
        replace: { status: rep.status, data: repJson },
      });
    } catch (e: any) {
      setResult({ error: String(e?.message ?? e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Admin Library</h1>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          marginTop: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>
          Replace PDF (Single File)
        </h2>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            Admin Secret
          </label>
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            type="password"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            Choose File (PDF)
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
              Selected: {file.name} ({Math.round(file.size / 1024)} KB)
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            Key (e.g. fcom_787 / fctm / qrh_777)
          </label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="fctm"
            style={{
              width: 320,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={deleteOld}
              onChange={(e) => setDeleteOld(e.target.checked)}
            />
            Delete old versions (optional)
          </label>
        </div>

        <button
          onClick={uploadAndReplace}
          disabled={!canSubmit || loading}
          style={{
            marginTop: 14,
            background: "black",
            color: "white",
            borderRadius: 10,
            padding: "10px 16px",
            opacity: !canSubmit || loading ? 0.5 : 1,
          }}
        >
          {loading ? "Working..." : "Replace & Index"}
        </button>

        <div style={{ marginTop: 14 }}>
          <pre
            style={{
              background: "#f6f6f6",
              padding: 12,
              borderRadius: 10,
              overflow: "auto",
            }}
          >
            {result ? JSON.stringify(result, null, 2) : "{\n  \n}"}
          </pre>
        </div>
      </section>
    </main>
  );
}
